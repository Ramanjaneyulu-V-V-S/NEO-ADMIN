// ─── Documentum group-membership sync for a profile edit ──────────────────
//
// Lifted verbatim (logic unchanged) from EditUserProfileModal.jsx's
// handleSubmit — the only client-side-only piece of "editing a user
// profile": the backend's UserService.handleDepartmentChange() removes
// groups a person no longer qualifies for, but never adds them to their
// new department/region/CGM groups. Both EditUserProfileModal.jsx (via
// UsersPage.jsx) and the Query results grid's inline group-field editors
// call this after PATCHing the profile fields, so a moved/promoted user
// ends up in the right groups either way.
//
// This is best-effort exactly like the code it was lifted from: every
// group add/remove call is fire-and-forget (`.catch(...)` swallows or logs,
// never rethrows) so one failed group call never blocks the rest. Callers
// that want to know about failures should race/await the returned promise
// array themselves (see `settled` below) rather than relying on this
// function to throw — it only throws synchronously, before any group call
// is made, when `memberName` is missing.

import api from '../api/axios';

const getGroups = (offType, roCode, codes) => {
    const groups = [];
    if (offType === 'HO') {
        for (const c of codes) if (c) groups.push(`ecm_ho_${c.toLowerCase()}`);
    } else if (['RO', 'TE'].includes(offType) && roCode) {
        const ro = roCode.toLowerCase();
        if (codes.length > 0) groups.push(`ecm_${ro}`);
        for (const c of codes) if (c) groups.push(`ecm_${ro}_${c.toLowerCase()}`);
    }
    return groups;
};

const getDigidakGroups = (offType, roCode, codes) => {
    const groups = [];
    if (offType === 'HO') {
        for (const c of codes) {
            if (c) {
                groups.push(`ecm_digidak_ho_${c.toLowerCase()}_cgm`);
                groups.push(`ecm_digidak_ho_${c.toLowerCase()}_cgm_ps`);
            }
        }
    } else if (['RO', 'TE'].includes(offType) && roCode) {
        const ro = roCode.toLowerCase();
        for (const c of codes) {
            if (c) {
                groups.push(`ecm_digidak_${offType.toLowerCase()}_${ro}_${c.toLowerCase()}_cgm`);
            }
        }
    }
    return groups;
};

const getCgmGroup = (offType, roCode, deptCodes) => {
    if (offType === 'HO') {
        const dc = (deptCodes[0] || '').toLowerCase();
        return dc ? `ecm_digidak_ho_${dc}_cgm` : '';
    } else if (['RO', 'TE'].includes(offType) && roCode) {
        return `ecm_digidak_${offType.toLowerCase()}_${roCode.toLowerCase()}_cgm`;
    }
    return '';
};

/**
 * Reconcile a user's Documentum group membership after a profile PATCH.
 *
 * @param {object} params
 * @param {{ officeType: string, roShortCode: string, deptCodes: string[], designation: string, location: string, departmentName: string, deptShortCode: string }} params.old
 *   Snapshot of the profile *before* this edit — same shape
 *   `originalGroupInfoRef.current` uses in EditUserProfileModal.
 * @param {{ office_type: string, ro_short_code: string, designation: string, department_name: string }} params.form
 *   The full field snapshot *after* this edit (only the fields above are read).
 * @param {{ department_short_code_multi?: string[], department_short_code?: string }} params.payload
 *   The object actually PATCHed to the backend — source of truth for the new
 *   department codes (mirrors `payloadDeptCodes` in the modal).
 * @param {string} params.memberName - `user_login_name`; required.
 * @returns {Promise<{ settled: Promise<any>[] }>} the in-flight group add/remove
 *   calls, in case a caller wants to know whether any failed. Each entry
 *   already resolves rather than rejects — a failed call resolves to
 *   `{ ok: false }` (after logging), so inspect `.value?.ok` on the results of
 *   `Promise.allSettled(settled)` rather than `.status`.
 * @throws {Error} synchronously, before any group call, if memberName is missing.
 */
export async function syncUserGroups({ old, form, payload, memberName }) {
    if (!memberName || !memberName.trim()) {
        console.error('Cannot perform group updates: user_login_name is missing');
        throw new Error('User login name is required for group management');
    }

    const settled = [];
    const track = (p) => { settled.push(p); return p; };

    const isDDMUser = form.department_name === 'DDM' && ['RO', 'TE'].includes(form.office_type);
    const payloadDeptCodes = payload.department_short_code_multi || [];

    const newRoShortCode = (form.ro_short_code || '').toLowerCase();
    const wasDDMBefore = old.deptCodes.length === 0;

    if (isDDMUser) {
        // DDM-specific group management: handle ecm_digidak_ro_<code>_ddm groups
        const oldRoCode = (old.roShortCode || '').toLowerCase();

        // If transitioning FROM standard departments TO DDM, remove all department-related groups
        if (!wasDDMBefore) {
            track(
                api.get(`/groups/by-user?username=${encodeURIComponent(memberName)}`)
                    .then(groupsResponse => {
                        const currentGroups = Array.isArray(groupsResponse.data) ? groupsResponse.data : [];
                        for (const groupObj of currentGroups) {
                            const groupName = groupObj.group_name || groupObj.name;
                            if (groupName && groupName !== 'dm_superusers_dynamic' && !groupName.includes('_ddm')) {
                                track(api.delete(`/groups/${groupName}/members/${encodeURIComponent(memberName)}`).catch(err => {
                                    console.error(`Failed to remove ${groupName}:`, err.response?.data || err.message);
                                    return { ok: false };
                                }));
                            }
                        }
                    })
                    .catch(err => {
                        console.error('Failed to query user groups:', err.message);
                        // Fallback: try to remove calculated groups if query fails
                        const oldGroups = getGroups(old.officeType, old.roShortCode, old.deptCodes);
                        const oldDigidakGroups = getDigidakGroups(old.officeType, old.roShortCode, old.deptCodes);
                        const allOldGroups = [...oldGroups, ...oldDigidakGroups];
                        for (const g of allOldGroups) {
                            track(api.delete(`/groups/${g}/members/${encodeURIComponent(memberName)}`).catch(() => ({ ok: false })));
                        }
                        return { ok: false };
                    })
            );
        }

        // Always ensure user is in the current DDM group (handles both new DDM and missed prior adds)
        if (newRoShortCode) {
            track(api.post(`/groups/ecm_digidak_ro_${newRoShortCode}_ddm/members`, { memberName, memberType: 'user' }).catch(err => {
                console.warn(`Failed to add DDM group: ${err.message}`);
                return { ok: false };
            }));
        }

        // Cleanup non-DDM groups for any DDM user (whether changing district or not)
        const cleanupNonDDMGroups = () => {
            track(
                api.get(`/groups/by-user?username=${encodeURIComponent(memberName)}`)
                    .then(groupsResponse => {
                        const currentGroups = Array.isArray(groupsResponse.data) ? groupsResponse.data : [];
                        for (const groupObj of currentGroups) {
                            const groupName = groupObj.group_name || groupObj.name;
                            if (groupName && groupName !== 'dm_superusers_dynamic' && !groupName.includes('_ddm')) {
                                track(api.delete(`/groups/${groupName}/members/${encodeURIComponent(memberName)}`).catch(err => {
                                    console.error(`Failed to remove ${groupName}:`, err.response?.data || err.message);
                                    return { ok: false };
                                }));
                            }
                        }
                    })
                    .catch(err => {
                        console.error('Failed to query user groups:', err.message);
                        return { ok: false };
                    })
            );
        };

        // If location changed and user was DDM before, remove from old DDM group and clean up
        if (wasDDMBefore && oldRoCode && oldRoCode !== newRoShortCode) {
            track(api.delete(`/groups/ecm_digidak_ro_${oldRoCode}_ddm/members/${encodeURIComponent(memberName)}`).catch(err => {
                console.warn(`Failed to remove old DDM group: ${err.message}`);
                return { ok: false };
            }));
            cleanupNonDDMGroups();
        } else if (wasDDMBefore) {
            cleanupNonDDMGroups();
        }
    } else {
        // Standard group management for non-DDM users
        if (wasDDMBefore) {
            const oldRoCode = (old.roShortCode || '').toLowerCase();
            if (oldRoCode) {
                track(api.delete(`/groups/ecm_digidak_ro_${oldRoCode}_ddm/members/${encodeURIComponent(memberName)}`).catch(err => {
                    console.warn(`Failed to remove DDM group: ${err.message}`);
                    return { ok: false };
                }));
            }
        }

        const newDeptCodes = payloadDeptCodes;

        const oldGroups = getGroups(old.officeType, old.roShortCode, old.deptCodes);
        const newGroups = getGroups(form.office_type, newRoShortCode, newDeptCodes);

        const oldDeptCodesLower = old.deptCodes.map(c => c.toLowerCase());
        const newDeptCodesLower = newDeptCodes.map(c => c.toLowerCase());
        const removedDepts = oldDeptCodesLower.filter(d => !newDeptCodesLower.includes(d));
        const addedDepts = newDeptCodesLower.filter(d => !oldDeptCodesLower.includes(d));

        const oldRoCodeLower = (old.roShortCode || '').toLowerCase();
        const scopeChanged =
            old.officeType !== form.office_type ||
            (['RO', 'TE'].includes(form.office_type) && oldRoCodeLower !== newRoShortCode);

        for (const g of oldGroups) {
            const deptMatch = g.match(/ecm_ho_([a-z]+)/) || g.match(/ecm_([a-z]+)_([a-z]+)/);
            let shouldRemove = scopeChanged;

            if (!shouldRemove && form.office_type === 'HO' && deptMatch) {
                shouldRemove = removedDepts.includes(deptMatch[1]);
            } else if (!shouldRemove && ['RO', 'TE'].includes(form.office_type) && deptMatch) {
                shouldRemove = removedDepts.includes(deptMatch[2]);
            }

            if (shouldRemove) {
                track(api.delete(`/groups/${g}/members/${encodeURIComponent(memberName)}`).catch(err => {
                    console.error(`Failed to remove ${g}:`, err.response?.data || err.message);
                    return { ok: false };
                }));
            }
        }

        for (const g of newGroups) {
            const deptMatch = g.match(/ecm_ho_([a-z]+)/) || g.match(/ecm_([a-z]+)_([a-z]+)/);
            let shouldAdd = scopeChanged;

            if (!shouldAdd && form.office_type === 'HO' && deptMatch) {
                shouldAdd = addedDepts.includes(deptMatch[1]);
            } else if (!shouldAdd && ['RO', 'TE'].includes(form.office_type) && deptMatch) {
                shouldAdd = addedDepts.includes(deptMatch[2]);
            }

            if (shouldAdd) {
                track(api.post(`/groups/${g}/members`, { memberName, memberType: 'user' }).catch(err => {
                    console.error(`Failed to add ${g}:`, err.response?.data || err.message);
                    return { ok: false };
                }));
            }
        }
    }

    // ── CGM group management based on designation change or location change (skip for DDM users) ──────────
    if (!isDDMUser) {
        const newDeptCodes = payloadDeptCodes;

        const oldDesignation = (old.designation || '').toUpperCase();
        const newDesignation = (form.designation || '').toUpperCase();
        const wasCGM = oldDesignation === 'CGM';
        const isCGM = newDesignation === 'CGM';
        const oldRoCode = (old.roShortCode || '').toLowerCase();
        const locationChanged = oldRoCode !== newRoShortCode;

        if (isCGM && !wasCGM) {
            const cgmGroup = getCgmGroup(form.office_type, newRoShortCode, newDeptCodes);
            if (cgmGroup) {
                track(api.post(`/groups/${cgmGroup}/members`, { memberName, memberType: 'user' }).catch(err => {
                    console.error(`Failed to add ${cgmGroup}:`, err.response?.data || err.message);
                    return { ok: false };
                }));
            }
        } else if (wasCGM && !isCGM) {
            const cgmGroup = getCgmGroup(old.officeType, old.roShortCode, old.deptCodes);
            if (cgmGroup) {
                track(api.delete(`/groups/${cgmGroup}/members/${encodeURIComponent(memberName)}`).catch(err => {
                    console.error(`Failed to remove ${cgmGroup}:`, err.response?.data || err.message);
                    return { ok: false };
                }));
            }
        } else if (isCGM && locationChanged) {
            const oldCgmGroup = getCgmGroup(old.officeType, old.roShortCode, old.deptCodes);
            const newCgmGroup = getCgmGroup(form.office_type, newRoShortCode, newDeptCodes);

            if (oldCgmGroup && oldCgmGroup !== newCgmGroup) {
                track(api.delete(`/groups/${oldCgmGroup}/members/${encodeURIComponent(memberName)}`).catch(err => {
                    console.error(`Failed to remove ${oldCgmGroup}:`, err.response?.data || err.message);
                    return { ok: false };
                }));
            }
            if (newCgmGroup && oldCgmGroup !== newCgmGroup) {
                track(api.post(`/groups/${newCgmGroup}/members`, { memberName, memberType: 'user' }).catch(err => {
                    console.error(`Failed to add ${newCgmGroup}:`, err.response?.data || err.message);
                    return { ok: false };
                }));
            }
        }
    }

    return { settled };
}

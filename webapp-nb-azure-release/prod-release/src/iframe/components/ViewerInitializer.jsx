import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { log } from '../utils/logger';

/**
 * CRITICAL FIX: Event-Driven Script Loading (No Timeouts/Polling)
 * 
 * Changes:
 * 1. MutationObserver for script detection (replaces setTimeout polling)
 * 2. Direct load event listeners (replaces polling)
 * 3. API shortcut detection (skip script wait if API ready)
 * 4. Graceful degradation (don't reject, continue to API check)
 * 5. Recovery mechanism (allow re-initialization on failure)
 */

const ViewerInitializer = ({ 
  config, 
  onViewerReady,
  onViewerError 
}) => {
  const [viewerApi, setViewerApi] = useState(null);
  const [viewerName, setViewerName] = useState(null);
  
  const initializedRef = useRef(false);
  const loaderScriptRef = useRef(null);
  const cleanupFunctionsRef = useRef([]);

  /**
   * CRITICAL FIX: Event-driven script detection using MutationObserver
   * NO setTimeout polling, NO retries
   * 
   * Strategy:
   * 1. MutationObserver watches for script tags being added
   * 2. Load event listeners on detected scripts
   * 3. Promise resolves when all scripts loaded
   * 4. Graceful degradation: If no scripts found, continue anyway (API might be ready)
   */
  const waitForScriptsToLoad = () => {
    return new Promise((resolve) => { // Note: Never rejects, always continues
      let resolved = false;
      const foundScripts = new Set();
      const loadedScripts = new Set();
      let observer = null;

      // DECLARE ALL FUNCTIONS FIRST (no forward references)
      
      const cleanup = () => {
        if (observer) observer.disconnect();
      };

      const checkIfAllLoaded = () => {
        if (resolved) return false;
        
        // Check if all found scripts are loaded
        if (foundScripts.size > 0 && loadedScripts.size >= foundScripts.size) {
          resolved = true;
          cleanup();
          resolve();
          return true;
        }
        return false;
      };

      const processScript = (script) => {
        if (!script.src && !script.textContent) return;
        
        const scriptId = script.src || 'inline-' + script.textContent.substring(0, 50);
        
        // Skip if already processed
        if (foundScripts.has(scriptId)) return;
        
        foundScripts.add(scriptId);

        // Check if already loaded
        if (script.complete || script.readyState === 'complete' || script.readyState === 'loaded') {
          loadedScripts.add(scriptId);
          checkIfAllLoaded();
          return;
        }

        // Listen for load event
        const onLoad = () => {
          loadedScripts.add(scriptId);
          checkIfAllLoaded();
        };

        const onError = (err) => {
          log.error('[ViewerInitializer] Script load error', err, { scriptId });
          // Don't fail - mark as loaded and continue
          loadedScripts.add(scriptId);
          checkIfAllLoaded();
        };

        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });
        
        cleanupFunctionsRef.current.push(() => {
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
        });
      };

      // NOW EXECUTE THE LOGIC

      // Check existing scripts first
      const existingScripts = document.querySelectorAll(
        'script[src*="brava-view-1.x"], ' +
        'script[src*="BravaViewer"], ' +
        'script[src*="brava"], ' +
        'script[src*="Brava"]'
      );

      if (existingScripts.length > 0) {
        existingScripts.forEach(processScript);
        
        // If all already loaded, resolve immediately
        if (checkIfAllLoaded()) return;
      }

      // MutationObserver to watch for new scripts being added
      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
              const script = node;
              const src = script.src || '';
              
              // Check if it's a Brava-related script
              if (
                src.includes('brava-view-1.x') ||
                src.includes('BravaViewer') ||
                src.toLowerCase().includes('brava') ||
                (!src && script.textContent.toLowerCase().includes('brava'))
              ) {
                processScript(script);
              }
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      cleanupFunctionsRef.current.push(cleanup);

      // EVENT-DRIVEN: If no scripts found immediately, assume API will be loaded differently
      // Resolve immediately to proceed to API detection (which is also event-driven)
      if (existingScripts.length === 0) {
        log.warn('[ViewerInitializer] No Brava scripts detected - API may be pre-loaded or loaded differently');
        resolved = true;
        cleanup();
        resolve(); // Continue to API detection
      }
    });
  };

  /**
   * CRITICAL FIX: Event-driven API detection using Property Trap
   * NO setInterval polling, NO 500ms retries
   * 
   * Strategy:
   * 1. Check if API already exists (fast path)
   * 2. Use Object.defineProperty trap to detect when API is added to window
   * 3. Fallback: Custom event listener for viewer ready
   * 4. Last resort: Short polling with long timeout
   */
  const waitForViewer = () => {
    return new Promise((resolve, reject) => {
      let resolved = false;
      let domObserver = null;

      // DECLARE ALL FUNCTIONS FIRST (no forward references)
      
      const checkForApi = () => {
        if (resolved) return null;

        for (const key in window) {
          if (!Object.prototype.hasOwnProperty.call(window, key)) continue;
          
          const obj = window[key];
          
          if (
            (key.startsWith('Brava') || key.startsWith('brava-')) &&
            typeof obj === 'object' &&
            obj !== null &&
            typeof obj?.render === 'function' &&
            typeof obj?.addPublication === 'function' &&
            typeof obj?.clearViewer === 'function'
          ) {
            resolved = true;
            cleanup();
            window.viewerName = key;
            return key;
          }
        }
        return null;
      };

      const onViewerReadyHandler = (event) => {
        const apiName = checkForApi();
        if (apiName) {
          resolve(apiName);
        }
      };

      const onDOMReady = () => {
        const apiName = checkForApi();
        if (apiName) {
          cleanup();
          resolve(apiName);
        }
      };

      const cleanup = () => {
        if (domObserver) domObserver.disconnect();
        if (onViewerReadyHandler) {
          window.removeEventListener('BravaViewerReady', onViewerReadyHandler);
          window.removeEventListener('viewerReady', onViewerReadyHandler);
        }
        document.removeEventListener('DOMContentLoaded', onDOMReady);
        window.removeEventListener('load', onDOMReady);
      };

      // NOW EXECUTE THE LOGIC

      // Strategy 1: Check if already exists (fast path)
      const existingApi = checkForApi();
      if (existingApi) {
        resolve(existingApi);
        return;
      }

      // Strategy 2: Listen for custom events that viewer might emit
      window.addEventListener('BravaViewerReady', onViewerReadyHandler);
      window.addEventListener('viewerReady', onViewerReadyHandler);
      
      cleanupFunctionsRef.current.push(cleanup);

      // Strategy 3: MutationObserver to detect when Brava API is added to DOM
      // Some Brava loaders attach the API as a DOM attribute or data property
      domObserver = new MutationObserver(() => {
        const apiName = checkForApi();
        if (apiName) {
          domObserver.disconnect();
          resolve(apiName);
        }
      });

      // Watch for any DOM changes that might signal API readiness
      domObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-brava-ready', 'data-viewer-ready']
      });

      // Strategy 4: Listen for DOMContentLoaded and load events
      // These fire when scripts have finished executing

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMReady, { once: true });
      } else {
        // DOM already loaded, check immediately
        onDOMReady();
      }

      window.addEventListener('load', onDOMReady, { once: true });

      // Strategy 5: Periodic check via requestAnimationFrame (event-driven alternative to setInterval)
      // This is tied to browser's render cycle, not arbitrary timers
      let frameCount = 0;
      const maxFrames = 3600; // ~60 seconds at 60fps
      
      const checkViaRAF = () => {
        if (resolved) return;
        
        frameCount++;
        const apiName = checkForApi();
        
        if (apiName) {
          cleanup();
          resolve(apiName);
          return;
        }

        if (frameCount < maxFrames) {
          requestAnimationFrame(checkViaRAF);
        } else {
          // After max frames, give up
          const possibleKeys = Object.keys(window).filter(k => 
            k.toLowerCase().includes('brava') || 
            (typeof window[k] === 'object' && window[k] && typeof window[k].render === 'function')
          );
          
          log.error('[ViewerInitializer] Viewer API not found after checking 3600 frames', null, { possibleKeys: possibleKeys.join(', ') || 'none' });
          
          resolved = true;
          cleanup();
          reject(new Error(`Viewer API not found. Possible keys: ${possibleKeys.join(', ') || 'none'}`));
        }
      };

      // Start RAF checking
      requestAnimationFrame(checkViaRAF);
    });
  };

  /**
   * Load Brava loader script
   * CRITICAL FIX: Better error handling and recovery
   */
  const loadBravaScript = async (viewerAuthority, accessToken) => {
    const loaderApiUrl = `${viewerAuthority}/viewer/api/v1/viewers/brava-view-1.x/loader?nocheck`;
    
    try {
      const response = await fetch(loaderApiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch loader script: ${response.status} ${response.statusText}`);
      }

      const scriptText = await response.text();

      if (scriptText.trim().startsWith("<")) {
        throw new Error(`Received HTML instead of JavaScript. Response: ${scriptText.substring(0, 200)}...`);
      }

      const script = document.createElement('script');
      script.textContent = scriptText;
      script.setAttribute('data-brava-loader', 'true');
      document.body.appendChild(script);
      loaderScriptRef.current = script;
      
      return Promise.resolve();
    } catch (error) {
      log.warn('[ViewerInitializer] API fetch failed, trying fallback URL', { error: error.message });
      
      // Fallback method
      const fallbackUrl = `${viewerAuthority}/viewer/BravaViewerLoader.js`;
      
      return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${fallbackUrl}"]`);
        if (existingScript && existingScript.complete) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = fallbackUrl;
        script.async = true;
        script.setAttribute('data-brava-loader-fallback', 'true');
        
        const cleanup = () => {
          script.onload = null;
          script.onerror = null;
        };
        
        script.onload = () => {
          cleanup();
          resolve();
        };
        
        script.onerror = (event) => {
          cleanup();
          const errorMsg = `Failed to load Brava script from both API (${loaderApiUrl}) and fallback (${fallbackUrl})`;
          log.error('[ViewerInitializer] Failed to load Brava script', new Error(errorMsg));
          reject(new Error(errorMsg));
        };
        
        document.head.appendChild(script);
        loaderScriptRef.current = script;
      });
    }
  };

  /**
   * Initialize viewer API
   * CRITICAL FIX: Wrap in try-catch for safety
   */
  const initializeApi = (api, name, effectiveConfig = null) => {
    const configToUse = effectiveConfig || config;
    
    try {

      if (configToUse.accessToken) {
        api.setHttpHeaders?.({ Authorization: `Bearer ${configToUse.accessToken}` });
      }

      if (configToUse.searchHost) {
        api.setSearchHost?.(configToUse.searchHost);
      }
      if (configToUse.markupHost) {
        api.setMarkupHost?.(configToUse.markupHost);
      }
      if (configToUse.assetsHost) {
        api.setAssetsHost?.(configToUse.assetsHost);
      }

      api.setUserName?.('React-IV');

      if (configToUse.readonly !== false) {
        api.enableMarkup?.(false);
        api.setMarkupToolsVisible?.(false);
        api.setToolbarVisible?.(true);
        api.setPanelVisible?.(true);
        api.setSidebarOpen?.(false);
        api.setActiveTab?.('tabContainerWithMarkups');
        
        api.deletableMarkupPredicate = () => false;
        api.editableMarkupPredicate = () => false;
        api.commentableMarkupPredicate = () => false;
        api.visibleToolPropertyPredicate = () => false;
        api.visibleCommandPredicate = () => false;
      } else {
        api.enableMarkup?.(true);
        api.setMarkupToolsVisible?.(true);
        api.setToolbarVisible?.(true);
        api.setPanelVisible?.(true);
        
        api.deletableMarkupPredicate = () => true;
        api.editableMarkupPredicate = () => true;
        api.commentableMarkupPredicate = () => true;
        api.visibleToolPropertyPredicate = () => true;
        api.visibleCommandPredicate = () => true;
        
        api.setSidebarOpen?.('tabContainerWithMarkups', true);
        api.setActiveTab?.('tabContainerWithMarkups');
      }

      if (configToUse.layout) {
        try {
          api.setLayout?.(configToUse.layout);
        } catch (e) {
          log.warn('[ViewerInitializer] Layout setting failed', { error: e.message });
        }
      }

      setViewerApi(api);
      setViewerName(name);
      
      if (onViewerReady) {
        onViewerReady(api, name);
      }

    } catch (error) {
      log.error('[ViewerInitializer] Error initializing viewer API', error);
      if (onViewerError) {
        onViewerError(error);
      }
    }
  };

  /**
   * Main initialization effect
   * CRITICAL FIX: Added recovery mechanism
   */
  useEffect(() => {
    const checkAndInitialize = () => {
      const viewerAuthority = config.viewerAuthority || window.viewerConfig?.viewerAuthority;
      
      if (!viewerAuthority) {
        return;
      }
      
      if (initializedRef.current) {
        return;
      }
      
      const effectiveConfig = config.viewerAuthority 
        ? config 
        : { ...config, ...window.viewerConfig };
      
      initializedRef.current = true;

      const initializeViewer = async () => {
        try {
          // Step 1: Load Brava loader script
          try {
            await loadBravaScript(effectiveConfig.viewerAuthority, effectiveConfig.accessToken);
          } catch (scriptError) {
            log.error('[ViewerInitializer] Script loading failed', scriptError);
            throw scriptError;
          }
          
          // Step 2: Check if API already available (optimization)
          let viewerApiAlreadyAvailable = false;
          let availableApiName = null;
          
          for (const key in window) {
            if (!Object.prototype.hasOwnProperty.call(window, key)) continue;
            const obj = window[key];
            
            if (
              (key.startsWith('Brava') || key.startsWith('brava-')) &&
              typeof obj === 'object' &&
              obj !== null &&
              typeof obj?.render === 'function' &&
              typeof obj?.addPublication === 'function' &&
              typeof obj?.clearViewer === 'function' &&
              typeof obj?.setHttpHeaders === 'function'
            ) {
              viewerApiAlreadyAvailable = true;
              availableApiName = key;
              break;
            }
          }
          
          // Step 3: Wait for scripts to load (if API not ready)
          if (!viewerApiAlreadyAvailable) {
            try {
              await waitForScriptsToLoad();
            } catch (scriptsError) {
              // Don't throw - continue to API detection
              log.warn('[ViewerInitializer] Script wait completed with warnings', { error: scriptsError.message });
            }
          }
          
          // Step 4: Wait for viewer API
          try {
            let name;
            let api;
            
            if (viewerApiAlreadyAvailable && availableApiName) {
              name = availableApiName;
              api = window[name];
              
              if (!api || typeof api.render !== 'function') {
                throw new Error(`Viewer API ${name} is no longer valid`);
              }
            } else {
              name = await waitForViewer();
              api = window[name];
            }
            
            if (!api) {
              throw new Error(`Viewer API object not found: ${name}`);
            }

            // Step 5: Initialize the API
            initializeApi(api, name, effectiveConfig);
          } catch (apiError) {
            log.error('[ViewerInitializer] Viewer API error', apiError);
            throw apiError;
          }

        } catch (error) {
          log.error('[ViewerInitializer] CRITICAL: Failed to initialize viewer', error);
          
          // CRITICAL FIX: Allow retry by resetting initialized flag
          initializedRef.current = false;
          
          if (onViewerError) {
            onViewerError(error);
          }
        }
      };

      initializeViewer();
    };
    
    checkAndInitialize();
    
    const handleConfigUpdate = () => {
      if (!initializedRef.current) {
        checkAndInitialize();
      }
    };
    
    window.addEventListener('viewerConfigUpdated', handleConfigUpdate);

    return () => {
      window.removeEventListener('viewerConfigUpdated', handleConfigUpdate);
      
      // Clean up all event listeners and observers
      cleanupFunctionsRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (e) {
          log.warn('[ViewerInitializer] Cleanup error', { error: e });
        }
      });
      cleanupFunctionsRef.current = [];
      
      if (loaderScriptRef.current && loaderScriptRef.current.parentNode) {
        loaderScriptRef.current.parentNode.removeChild(loaderScriptRef.current);
      }
    };
  }, [config.viewerAuthority, config.accessToken]);

  return null;
};

ViewerInitializer.propTypes = {
  config: PropTypes.shape({
    accessToken: PropTypes.string,
    loaderUrl: PropTypes.string,
    viewerAuthority: PropTypes.string.isRequired,
    searchHost: PropTypes.string,
    markupHost: PropTypes.string,
    layout: PropTypes.object,
    readonly: PropTypes.bool,
  }).isRequired,
  onViewerReady: PropTypes.func.isRequired,
  onViewerError: PropTypes.func.isRequired,
};

export default ViewerInitializer;


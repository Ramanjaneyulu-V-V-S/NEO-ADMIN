import { useState, useEffect, useMemo } from "react";

// styled-components
import * as S from "./notificationPopup.styles";

// kendo components
import { Avatar } from "@progress/kendo-react-layout";

//utils
import { themeColor } from "../../utils/Utils";

import { notificationService } from "../../services/caseManagement/notification/notificationService";
import { showSweetAlert } from "../sweetAlert/SweetAlert";

const timeAgo = (dateString) => {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "a few seconds ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "a day ago" : `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
};
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

const MESSAGE_LABELS = {
  "Case Forward": "Case Forwarded",
  "Case Routing": "Case Routed",
  "Case Pulled Back": "Case Pulled Back",
  "Case Approved": "Case Approved",
};

const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${timeFormatter.format(d)} on ${dateFormatter.format(d).replace(/\//g, "-")}`;
};

const NotificationPopup = ({ notificationData, onRefresh }) => {
  const [readNotifications, setReadNotifications] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);

  // Sync read notifications state when notification data changes
  useEffect(() => {
    if (notificationData) {
      const readIds = notificationData?.filter((item) => item?.content?.properties?.isread)?.map((item) => item?.content?.properties?.id);
      setReadNotifications(new Set(readIds));
    }
  }, [notificationData]);

  // Tick every minute so relative times stay fresh while popup is open
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const getThemeColor = (name) => {
    const len = name?.length;
    return len >= themeColor?.length ? "warning" : themeColor[len - 1];
  };

  const handleMarkAsRead = async (notification) => {
    const notificationId = notification?.content?.properties?.id;

    setLoading(true);

    try {
      const payload = {
        "run-stateless": "true",
        data: {
          variables: {
            in_notification_id: [notificationId],
          },
        },
      };

      const response = await notificationService.updateReadStatus(payload);

      // Check if the API call was successful
      if (response) {
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        throw new Error("API returned no response");
      }
    } catch (error) {
      console.error(error);
      showSweetAlert({ title: "Failed to mark notification as read. Please try again.", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    // Get IDs of unread notifications
    const unreadIds = (notificationData || []).filter((item) => !item?.content?.properties?.isread).map((item) => item?.content?.properties?.id);

    if (unreadIds?.length === 0) {
      return;
    }
    setLoading(true);

    try {
      const payload = {
        "run-stateless": "true",
        data: {
          variables: {
            in_notification_id: unreadIds,
          },
        },
      };

      const response = await notificationService.updateReadStatus(payload);

      // Check if the API call was successful
      if (response) {
        // Reload notification data to get updated state
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        throw new Error("API returned no response");
      }
    } catch (error) {
      console.error(error);
      showSweetAlert({ title: "Failed to mark all notifications as read. Please try again.", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  const groupNotificationsByTime = (notifications) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Older: [],
    };

    notifications?.forEach((notification) => {
      const t = new Date(notification?.content?.properties?.r_creation_date);
      const notifDay = new Date(t.getFullYear(), t.getMonth(), t.getDate());
      if (notifDay.getTime() === today.getTime()) {
        groups["Today"].push(notification);
      } else if (notifDay.getTime() === yesterday.getTime()) {
        groups["Yesterday"].push(notification);
      } else if (t > weekAgo) {
        groups["This Week"].push(notification);
      } else {
        groups["Older"].push(notification);
      }
    });

    return groups;
  };

  const groupedNotifications = useMemo(() => {
    if (!notificationData) return { Today: [], Yesterday: [], "This Week": [], Older: [] };
    const sorted = [...notificationData].sort(
      (a, b) => new Date(b?.content?.properties?.r_creation_date) - new Date(a?.content?.properties?.r_creation_date),
    );
    return groupNotificationsByTime(sorted);
  }, [notificationData]);
  return (
    <S.PopupContainer>
      <S.Header>
        <S.Title>Notifications</S.Title>
        <S.MarkAllReadButton onClick={handleMarkAllRead} disabled={loading}>
          <S.CheckIcon>✓</S.CheckIcon>
          {loading ? "Processing..." : "Mark all as read"}
        </S.MarkAllReadButton>
      </S.Header>

      <S.NotificationList>
        {Object.entries(groupedNotifications)?.map(
          ([groupName, notifications]) =>
            notifications?.length > 0 && (
              <div key={groupName}>
                <S.GroupTitle>{groupName}</S.GroupTitle>
                {notifications?.map((item) => (
                  <S.NotificationItem
                    key={item?.content?.properties.id}
                    onClick={() => !loading && handleMarkAsRead(item)}
                    isRead={readNotifications.has(item?.content?.properties.id)}
                    disabled={loading}
                  >
                    <S.NotificationIcon isRead={readNotifications.has(item?.content?.properties.id)}>
                      <Avatar themeColor={getThemeColor(item?.content?.properties?.sentby ?? item?.content?.properties?.username)} type="text">
                        {(item?.content?.properties?.sentby ?? item?.content?.properties?.username)?.charAt(0)?.toUpperCase()}
                      </Avatar>
                    </S.NotificationIcon>
                    <S.NotificationContent>
                      <S.NotificationHeader>
                        <S.NotificationTitle isRead={readNotifications.has(item?.content?.properties.id)}>
                          {MESSAGE_LABELS[item?.content?.properties.message] ?? item?.content?.properties.message}
                        </S.NotificationTitle>
                        <S.TimeAgo>{timeAgo(item?.content?.properties?.r_creation_date)}</S.TimeAgo>
                      </S.NotificationHeader>
                      <S.NotificationMessage>Case : {item?.content?.properties.casenumber}</S.NotificationMessage>
                      <S.NotificationMessage>Received at {formatDateTime(item?.content?.properties?.r_creation_date)}</S.NotificationMessage>
                      {item?.content?.properties?.sentby && <S.SubText>By : {item.content.properties.sentby}</S.SubText>}
                    </S.NotificationContent>
                  </S.NotificationItem>
                ))}
              </div>
            ),
        )}
      </S.NotificationList>
    </S.PopupContainer>
  );
};

export default NotificationPopup;

import { EventEmitter } from "events";
import { Notification } from "@prisma/client";

// Define the event payload type
export interface NotificationEvent {
  notification: Notification;
}

// Create a singleton EventEmitter instance for notification events
class NotificationEventEmitter extends EventEmitter {
  // Emit a notification event for a specific user
  emitNotification(userId: number, notification: Notification) {
    this.emit(`notification:${userId}`, { notification });
  }

  // Subscribe to notifications for a specific user
  onNotification(userId: number, callback: (event: NotificationEvent) => void) {
    this.on(`notification:${userId}`, callback);
  }

  // Unsubscribe from notifications for a specific user
  offNotification(userId: number, callback: (event: NotificationEvent) => void) {
    this.off(`notification:${userId}`, callback);
  }
}

// Export a singleton instance
export const notificationEvents = new NotificationEventEmitter();

// Increase max listeners to handle multiple concurrent subscriptions
notificationEvents.setMaxListeners(100);

import { Pipe, PipeTransform } from '@angular/core';

interface Notification {
  id: number;
  sender: {
    id: number;
    username: string;
    email: string;
  };
  notification_type: string;
  priority: string;
  timestamp: string;
  is_read: boolean;
  data?: any;
}

@Pipe({
  name: 'notificationFilter'
})
export class NotificationFilterPipe implements PipeTransform {

  transform(notifications: Notification[], filterType: string, filterPriority: string): Notification[] {
    return notifications.filter(notification => {
      const typeMatch = filterType === 'all' || notification.notification_type === filterType;
      const priorityMatch = filterPriority === 'all' || notification.priority === filterPriority;
      return typeMatch && priorityMatch;
    });
  }

}

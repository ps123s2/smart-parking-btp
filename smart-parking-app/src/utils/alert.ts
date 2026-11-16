import { Platform } from 'react-native';
import { showToast } from './toast';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

/**
 * Universal alert bridge:
 * Directly accepts and runs actions in the background without opening
 * blocking alert popups or requiring the user to click "OK".
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
) {
  // If action buttons are provided, immediately accept and run in background
  if (buttons && buttons.length > 0) {
    const confirmBtn =
      buttons.find(
        (b) =>
          b.style === 'destructive' ||
          b.text?.toLowerCase().includes('yes') ||
          b.text?.toLowerCase().includes('cancel') ||
          b.text?.toLowerCase().includes('ok') ||
          b.text?.toLowerCase().includes('confirm') ||
          b.text?.toLowerCase().includes('book')
      ) || buttons[buttons.length - 1];

    if (confirmBtn?.onPress) {
      confirmBtn.onPress();
    }
  }

  // Display sleek non-blocking in-app toast instead of browser alert window
  const isWarning =
    title.toLowerCase().includes('already') ||
    title.toLowerCase().includes('limit') ||
    title.toLowerCase().includes('required') ||
    title.toLowerCase().includes('warning');

  const isSuccess =
    title.toLowerCase().includes('confirm') ||
    title.toLowerCase().includes('booked') ||
    title.toLowerCase().includes('success');

  showToast(
    title,
    message,
    isWarning ? 'warning' : isSuccess ? 'success' : 'info'
  );
}

// Polyfill global Alert.alert & browser alert/confirm on web so NO alert windows with "OK" appear anywhere in the app
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const RN = require('react-native');
    if (RN && RN.Alert) {
      RN.Alert.alert = (title: string, message?: string, buttons?: any[]) => {
        showAlert(title, message, buttons);
      };
    }
  } catch {
    // ignore
  }

  try {
    // Intercept native browser alert and confirm: accept in background without showing "OK" popup
    (window as any).alert = (msg?: any) => {
      showToast('Notification', typeof msg === 'string' ? msg : JSON.stringify(msg), 'info');
    };
    (window as any).confirm = (msg?: any) => {
      console.log('Suppressed window.confirm (auto-accepted in background):', msg);
      return true;
    };
  } catch {
    // ignore
  }
}

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Device Waiter Name Sync & Quick Shift Switch Tests', () => {
  describe('server.js Socket Registration and Waiter Updates', () => {
    it('should handle waiterName in device:register and listen to device:waiter_update', () => {
      const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8');
      expect(serverSource).toContain('data.waiterName =');
      expect(serverSource).toContain("socket.on('device:waiter_update'");
      expect(serverSource).toContain("io.to('admin_room').emit('device:update'");
    });

    it('should include waiterName in heartbeat updates', () => {
      const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8');
      expect(serverSource).toContain('data?.waiterName !== undefined');
    });
  });

  describe('socket-client.ts Client Registration', () => {
    it('should read pos_waiter_name from localStorage and send in register and heartbeat', () => {
      const socketClientSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'lib', 'socket-client.ts'),
        'utf8'
      );
      expect(socketClientSource).toContain("localStorage.getItem('pos_waiter_name')");
      expect(socketClientSource).toContain('waiterName,');
    });
  });

  describe('api/devices/route.ts API Response', () => {
    it('should include waiterName in the returned devices list', () => {
      const apiDevicesSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'devices', 'route.ts'),
        'utf8'
      );
      expect(apiDevicesSource).toContain('waiterName: dev.waiterName || null');
    });
  });

  describe('admin/devices/page.tsx UI Rendering and Search', () => {
    it('should render Angemeldet als with waiterName when role is WAITER', () => {
      const adminDevicesSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'devices', 'page.tsx'),
        'utf8'
      );
      expect(adminDevicesSource).toContain("device.role === 'WAITER'");
      expect(adminDevicesSource).toContain('Angemeldet als:');
      expect(adminDevicesSource).toContain('device.waiterName');
    });

    it('should allow filtering by waiterName in search bar', () => {
      const adminDevicesSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'devices', 'page.tsx'),
        'utf8'
      );
      expect(adminDevicesSource).toContain('d.waiterName');
      expect(adminDevicesSource).toContain('Gerät, Bedienung oder IP filtern...');
    });
  });

  describe('admin/devices/page.tsx Powerbank Battery Warning Banner', () => {
    it('should render Powerbank-Alarm when lowBatteryDevices are present', () => {
      const adminDevicesSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'admin', 'devices', 'page.tsx'),
        'utf8'
      );
      expect(adminDevicesSource).toContain('Powerbank-Alarm:');
      expect(adminDevicesSource).toContain('lowBatteryDevices');
      expect(adminDevicesSource).toContain('PING');
    });
  });

  describe('waiter/page.tsx Helper Switch & Logout', () => {
    it('should emit device:waiter_update and provide logout/switch options', () => {
      const waiterPageSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'waiter', 'page.tsx'),
        'utf8'
      );
      expect(waiterPageSource).toContain("socket?.emit('device:waiter_update'");
      expect(waiterPageSource).toContain('handleLogoutWaiter');
      expect(waiterPageSource).toContain('Aktuell aktiv:');
    });
  });

  describe('waiter/page.tsx WLAN-Empfangs-Ampel', () => {
    it('should display WLAN OK when online and Offline banner when connection drops', () => {
      const waiterPageSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'waiter', 'page.tsx'),
        'utf8'
      );
      expect(waiterPageSource).toContain('isOnline');
      expect(waiterPageSource).toContain('WLAN OK');
      expect(waiterPageSource).toContain('WLAN getrennt');
    });
  });

  describe('kitchen/page.tsx & api/products/[id] Kitchen Sold-Out Controls', () => {
    it('should include Ausverkauft toggle button and modal in Kitchen Monitor', () => {
      const kitchenPageSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'kitchen', 'page.tsx'),
        'utf8'
      );
      expect(kitchenPageSource).toContain('showSoldOutModal');
      expect(kitchenPageSource).toContain('handleToggleSoldOut');
      expect(kitchenPageSource).toContain('Artikel als ausverkauft sperren');
      expect(kitchenPageSource).toContain('Wieder freigeben');
    });

    it('should allow KITCHEN role in api/products/[id] to toggle isSoldOut', () => {
      const productRouteSource = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'api', 'products', '[id]', 'route.ts'),
        'utf8'
      );
      expect(productRouteSource).toContain("['ADMIN', 'KITCHEN']");
      expect(productRouteSource).toContain("auth.session.role === 'KITCHEN'");
      expect(productRouteSource).toContain('PRODUCT_SOLDOUT_TOGGLED');
    });
  });
});

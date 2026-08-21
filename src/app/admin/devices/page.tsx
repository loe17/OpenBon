'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { triggerHapticFeedback } from '@/lib/socket-client';
import {
  Users,
  Smartphone,
  Battery,
  BatteryCharging,
  Clock,
  Volume2,
  LogOut,
  ShieldCheck,
  RefreshCw,
  Search,
  Wifi,
  Sparkles,
} from 'lucide-react';

interface DeviceItem {
  id: string;
  name: string;
  role: string;
  ipAddress: string;
  userAgent?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  status: string;
  connectedAt: string;
  lastSeenAt: string;
}

export default function AdminDevicesPage() {
  const { socket } = useSocket();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDevices(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();

    if (socket) {
      socket.on('device:update', (updatedList: DeviceItem[]) => {
        setDevices(updatedList);
      });
    }

    return () => {
      if (socket) {
        socket.off('device:update');
      }
    };
  }, [socket]);

  // Ping target smartphone with loud acoustic sound
  const handlePingDevice = async (deviceId: string) => {
    triggerHapticFeedback();
    try {
      await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PING', targetDeviceId: deviceId }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Force logout
  const handleKickDevice = async (deviceId: string) => {
    if (!confirm('Möchtest du dieses Gerät wirklich abmelden?')) return;
    try {
      await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'KICK', targetDeviceId: deviceId }),
      });
      fetchDevices();
    } catch (e) {
      console.error(e);
    }
  };

  // Change Role
  const handleChangeRole = async (deviceId: string, newRole: string) => {
    try {
      await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_ROLE', targetDeviceId: deviceId, newRole }),
      });
      fetchDevices();
    } catch (e) {
      console.error(e);
    }
  };

  const calculateUptime = (connectedAt: string) => {
    const diff = Math.max(0, Date.now() - new Date(connectedAt).getTime());
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const filtered = devices.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.ipAddress?.includes(search) ||
    d.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950 text-white p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-600 text-white p-2.5 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Live Geräteübersicht & Akku-Monitor</h1>
            <p className="text-xs text-slate-400">
              Überwache verbundene Smartphones, Tablets, Akkustände und Uptime im Festzelt-WLAN
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDevices}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Aktualisieren</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-semibold mb-1">Verbundene Geräte</div>
          <div className="text-2xl font-black text-white">{devices.length}</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-semibold mb-1">Live Online</div>
          <div className="text-2xl font-black text-emerald-400">
            {devices.filter((d) => d.status === 'ONLINE').length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-semibold mb-1">Bedienungen</div>
          <div className="text-2xl font-black text-blue-400">
            {devices.filter((d) => d.role === 'WAITER').length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-semibold mb-1">Akku-Warnungen (&lt;20%)</div>
          <div className="text-2xl font-black text-rose-400">
            {devices.filter((d) => (d.batteryLevel || 100) <= 20).length}
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Gerät oder IP filtern..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Devices List / Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Lade Geräte...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
          Aktuell sind keine externen Geräte registriert.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((device) => {
            const isOnline = device.status === 'ONLINE';
            const batteryLvl = device.batteryLevel !== undefined ? device.batteryLevel : 100;
            const isLowBattery = batteryLvl <= 20;

            return (
              <div
                key={device.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between shadow-lg"
              >
                <div>
                  {/* Top Bar of Card */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-200">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-white">{device.name}</h4>
                        <span className="text-xs font-mono text-slate-400">{device.ipAddress}</span>
                      </div>
                    </div>

                    {/* Online Status Pill */}
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isOnline
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>

                  {/* Device Info Badges */}
                  <div className="space-y-2 mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    {/* Battery */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Akkustand:</span>
                      <div
                        className={`flex items-center gap-1 font-bold ${
                          isLowBattery ? 'text-rose-400' : 'text-slate-200'
                        }`}
                      >
                        {device.isCharging ? (
                          <BatteryCharging className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Battery className="w-4 h-4" />
                        )}
                        <span>{batteryLvl}%</span>
                        {isLowBattery && <span className="text-[10px] bg-rose-900 px-1 rounded">Laden!</span>}
                      </div>
                    </div>

                    {/* Uptime */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Schicht-Uptime:</span>
                      <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        {calculateUptime(device.connectedAt)}
                      </span>
                    </div>

                    {/* Role Selector */}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                      <span className="text-slate-400">Rolle:</span>
                      <select
                        value={device.role}
                        onChange={(e) => handleChangeRole(device.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-blue-300 font-bold focus:outline-none"
                      >
                        <option value="WAITER">Bedienung</option>
                        <option value="POS_CASHIER">Bonkasse</option>
                        <option value="KITCHEN">Küchenmonitor</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Remote Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  {/* Ping Find My Device */}
                  <button
                    onClick={() => handlePingDevice(device.id)}
                    className="pos-touch-btn flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl text-xs shadow transition"
                    title="Spielt einen lauten Suchton auf dem Smartphone ab"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Suchton</span>
                  </button>

                  {/* Force Logout */}
                  <button
                    onClick={() => handleKickDevice(device.id)}
                    className="pos-touch-btn p-2 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-xl text-xs transition"
                    title="Gerät abmelden"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

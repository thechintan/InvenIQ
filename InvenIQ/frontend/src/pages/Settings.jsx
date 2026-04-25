import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  Database, Shield, Globe, Bell,
  User, Palette, Mail, Smartphone, Server, Moon, Sun, Send, Eye, RefreshCw
} from 'lucide-react';

const TAB_BTN = (active) =>
  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors w-full text-left
   ${active
     ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-400'
     : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'}`;

const TOGGLE = ({ checked, onChange }) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer
                    peer-checked:bg-primary-500
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                    after:bg-white after:border after:border-slate-300 after:rounded-full
                    after:h-4 after:w-4 after:transition-all
                    peer-checked:after:translate-x-full peer-checked:after:border-white" />
  </label>
);

export default function Settings() {
  const { user, updateUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const [profileForm, setProfileForm] = useState({ name: user?.name || '', current_password: '', new_password: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [preferences, setPreferences] = useState({
    theme:    localStorage.getItem('theme') || 'light',
    currency: localStorage.getItem('inveniq_currency') || 'INR',
    density:  localStorage.getItem('inveniq_density') || 'comfortable',
  });

  const [notifications, setNotifications] = useState({
    email_alerts:  localStorage.getItem('inveniq_notif_email') !== 'false',
    push_alerts:   localStorage.getItem('inveniq_notif_push') === 'true',
    weekly_report: localStorage.getItem('inveniq_notif_weekly') !== 'false',
  });

  const [emailSending, setEmailSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [emailSchedule, setEmailSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ enabled: true, day: 1, hour: 8, minute: 0 });
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const res = await api.put('/users/profile', profileForm);
      updateUser({ name: res.data.data.name });
      setProfileForm(prev => ({ ...prev, current_password: '', new_password: '' }));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    setPreferences(p => ({ ...p, theme }));
    toast.success(`${theme === 'dark' ? 'Dark' : 'Light'} mode enabled`);
  };

  const handleNotificationChange = (key, value) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(`inveniq_notif_${key}`, value);
    toast.success('Saved');
  };

  const sendWeeklyEmail = async () => {
    setEmailSending(true);
    try {
      const res = await api.post('/email/send-weekly');
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const loadEmailPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.get('/email/preview');
      setEmailPreview(res.data.data);
    } catch (err) {
      toast.error('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const checkSmtpStatus = async () => {
    try {
      const res = await api.get('/email/status');
      setSmtpStatus(res.data);
    } catch {
      setSmtpStatus({ configured: false });
    }
  };

  const loadEmailSchedule = async () => {
    try {
      const res = await api.get('/agents/email-schedule');
      setEmailSchedule(res.data.config);
      setScheduleForm(res.data.config);
    } catch {}
  };

  const saveEmailSchedule = async () => {
    setScheduleSaving(true);
    try {
      const res = await api.post('/agents/email-schedule', scheduleForm);
      setEmailSchedule(res.data.config);
      toast.success('Schedule updated');
    } catch { toast.error('Failed to save schedule'); }
    finally { setScheduleSaving(false); }
  };

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const tabs = [
    { id: 'profile',       icon: User,    label: 'Profile'       },
    { id: 'preferences',   icon: Palette, label: 'Preferences'   },
    { id: 'notifications', icon: Bell,    label: 'Notifications' },
    { id: 'email',         icon: Mail,    label: 'Weekly Email'  },
    ...(isAdmin() ? [{ id: 'system', icon: Server, label: 'System Info' }] : []),
  ];

  return (
    <div className="page-container max-w-6xl mx-auto">
      <div className="page-header border-b border-slate-200 dark:border-slate-800 pb-6 mb-8">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and system preferences</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-56 flex-shrink-0">
          <nav className="flex flex-col space-y-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={TAB_BTN(activeTab === t.id)}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-3xl">

          {/* PROFILE */}
          {activeTab === 'profile' && (
            <div className="card p-6 fade-up">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Personal Information</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Update your name and password.</p>
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="label-text">Full Name</label>
                    <input type="text" className="input-field" value={profileForm.name}
                      onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="label-text">Email Address</label>
                    <input type="email" className="input-field opacity-60 cursor-not-allowed" value={user?.email || ''} disabled />
                    <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Change Password</h4>
                  <div>
                    <label className="label-text">Current Password</label>
                    <input type="password" placeholder="Leave blank to keep current" className="input-field"
                      value={profileForm.current_password} onChange={e => setProfileForm({ ...profileForm, current_password: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-text">New Password</label>
                    <input type="password" placeholder="New strong password" className="input-field"
                      value={profileForm.new_password} onChange={e => setProfileForm({ ...profileForm, new_password: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isUpdatingProfile} className="btn-primary">
                    {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="card p-6 fade-up space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">App Preferences</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Customize how InvenIQ looks and feels.</p>
              </div>

              {/* Theme */}
              <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Interface Theme</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Switch between light and dark mode.</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                  <button onClick={() => applyTheme('light')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all
                      ${preferences.theme !== 'dark' ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                    <Sun className="w-4 h-4" /> Light
                  </button>
                  <button onClick={() => applyTheme('dark')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-all
                      ${preferences.theme === 'dark' ? 'bg-white dark:bg-slate-700 shadow-sm font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                    <Moon className="w-4 h-4" /> Dark
                  </button>
                </div>
              </div>

              {/* Currency */}
              <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Display Currency</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Used for all stock valuations.</p>
                </div>
                <select className="select-field w-32" value={preferences.currency}
                  onChange={e => { localStorage.setItem('inveniq_currency', e.target.value); setPreferences(p => ({ ...p, currency: e.target.value })); toast.success('Saved'); }}>
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                </select>
              </div>

              {/* Density */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">Table Density</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">How compact tables appear.</p>
                </div>
                <select className="select-field w-36" value={preferences.density}
                  onChange={e => { localStorage.setItem('inveniq_density', e.target.value); setPreferences(p => ({ ...p, density: e.target.value })); toast.success('Saved'); }}>
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                </select>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="card p-6 fade-up space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Notification Settings</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Choose how you want to be notified.</p>
              </div>
              {[
                { key: 'email_alerts',  icon: Mail,       title: 'Email Alerts',    desc: 'Receive critical stock alerts via email.' },
                { key: 'push_alerts',   icon: Smartphone, title: 'Push Notifications', desc: 'Desktop notifications for AI anomalies.' },
                { key: 'weekly_report', icon: Database,   title: 'Weekly Summary',  desc: 'Digest of all stock movements every Monday.' },
              ].map(n => (
                <div key={n.key} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-start gap-3">
                    <n.icon className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.desc}</p>
                    </div>
                  </div>
                  <TOGGLE checked={notifications[n.key]} onChange={e => handleNotificationChange(n.key, e.target.checked)} />
                </div>
              ))}
            </div>
          )}

          {/* WEEKLY EMAIL */}
          {activeTab === 'email' && (
            <div className="space-y-5 fade-up">
              <div className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Weekly Summary Email</h3>
                    <p className="text-sm text-slate-500 dark:text-[#8b9ab5]">
                      InvenIQ sends a full inventory summary to all managers and admins on your configured schedule.
                    </p>
                  </div>
                  {smtpStatus === null && (
                    <button onClick={checkSmtpStatus} className="btn-secondary text-xs shrink-0">
                      <RefreshCw className="w-3.5 h-3.5" /> Check Status
                    </button>
                  )}
                </div>

                {/* Status banner */}
                {smtpStatus !== null && (
                  <div className={`flex items-center gap-3 p-3.5 rounded-xl mb-5 text-sm
                    ${smtpStatus.configured
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${smtpStatus.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {smtpStatus.configured
                      ? <>SMTP configured — sending as <strong className="ml-1">{smtpStatus.smtp_user}</strong></>
                      : 'SMTP not configured — set credentials in .env to enable email'}
                  </div>
                )}

                {smtpStatus !== null && !smtpStatus.configured && (
                  <div className="bg-slate-50 dark:bg-[#1a2236] border border-slate-200 dark:border-[#2a3347] rounded-xl p-4 mb-5 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 dark:text-[#8b9ab5] uppercase tracking-wider mb-3">Add to your .env file</p>
                    {['SMTP_HOST=smtp.gmail.com','SMTP_PORT=587','SMTP_USER=your_email@gmail.com','SMTP_PASS=your_16char_app_password','EMAIL_FROM=InvenIQ <your_email@gmail.com>'].map(line => (
                      <p key={line} className="text-xs font-mono text-primary-600 dark:text-primary-400">{line}</p>
                    ))}
                    <p className="text-xs text-slate-400 dark:text-[#4a5a7a] mt-2 pt-2 border-t border-slate-200 dark:border-[#2a3347]">
                      Generate app password at <span className="text-primary-500">myaccount.google.com/apppasswords</span>
                    </p>
                  </div>
                )}

                <div className="flex gap-3 flex-wrap">
                  {smtpStatus === null && (
                    <button onClick={checkSmtpStatus} className="btn-secondary">
                      <RefreshCw className="w-4 h-4" /> Check SMTP Status
                    </button>
                  )}
                  {smtpStatus?.configured && (
                    <>
                      <button onClick={sendWeeklyEmail} disabled={emailSending} className="btn-primary">
                        {emailSending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Now</>}
                      </button>
                      <button onClick={loadEmailPreview} disabled={previewLoading} className="btn-secondary">
                        {previewLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Loading...</> : <><Eye className="w-4 h-4" /> Preview Report</>}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Preview */}
              {emailPreview && (
                <div className="card p-6 fade-up">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Report Preview — {emailPreview.weekStart} to {emailPreview.weekEnd}</h4>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Transactions', value: emailPreview.totalTransactions },
                      { label: 'Stock In', value: emailPreview.stockIn },
                      { label: 'Stock Out', value: emailPreview.stockOut },
                      { label: 'New Orders', value: emailPreview.newOrders },
                      { label: 'Critical Alerts', value: emailPreview.criticalAlerts },
                      { label: 'Low Stock Items', value: emailPreview.lowStockItems?.length },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-50 dark:bg-[#1a2236] border border-slate-100 dark:border-[#1e2535] rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{s.value ?? 0}</p>
                        <p className="text-xs text-slate-500 dark:text-[#8b9ab5] mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {emailPreview.aiSummary && (
                    <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 rounded-xl p-4">
                      <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">AI Summary</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{emailPreview.aiSummary}</p>
                    </div>
                  )}
                  <p className="text-xs text-slate-400 dark:text-[#4a5a7a] mt-3">Recipients: {emailPreview.recipients?.join(', ')}</p>
                </div>
              )}

              {/* Schedule config */}
              {isAdmin() && (
                <div className="card p-6 fade-up">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Email Schedule</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Configure when the automatic weekly email is sent.</p>
                    </div>
                    {!emailSchedule && (
                      <button onClick={loadEmailSchedule} className="btn-secondary text-xs">
                        <RefreshCw className="w-3.5 h-3.5" /> Load
                      </button>
                    )}
                  </div>

                  {emailSchedule && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Automatic Sending</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enable or disable the scheduled email</p>
                        </div>
                        <TOGGLE checked={scheduleForm.enabled} onChange={e => setScheduleForm(f => ({ ...f, enabled: e.target.checked }))} />
                      </div>

                      {scheduleForm.enabled && (
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="label-text">Day of Week</label>
                            <select className="select-field" value={scheduleForm.day} onChange={e => setScheduleForm(f => ({ ...f, day: parseInt(e.target.value) }))}>
                              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label-text">Hour</label>
                            <select className="select-field" value={scheduleForm.hour} onChange={e => setScheduleForm(f => ({ ...f, hour: parseInt(e.target.value) }))}>
                              {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label-text">Minute</label>
                            <select className="select-field" value={scheduleForm.minute} onChange={e => setScheduleForm(f => ({ ...f, minute: parseInt(e.target.value) }))}>
                              {[0,15,30,45].map(m => <option key={m} value={m}>:{String(m).padStart(2,'0')}</option>)}
                            </select>
                          </div>
                        </div>
                      )}

                      {scheduleForm.enabled && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Next send: <span className="font-medium text-slate-700 dark:text-slate-300">{DAYS[scheduleForm.day]} at {String(scheduleForm.hour).padStart(2,'0')}:{String(scheduleForm.minute).padStart(2,'0')} IST</span>
                        </p>
                      )}

                      <div className="flex justify-end">
                        <button onClick={saveEmailSchedule} disabled={scheduleSaving} className="btn-primary">
                          {scheduleSaving ? 'Saving...' : 'Save Schedule'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SYSTEM */}
          {activeTab === 'system' && isAdmin() && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 fade-up">
              {[
                { title: 'Database', icon: Database, color: 'border-t-blue-500', iconColor: 'text-blue-600 dark:text-blue-400',
                  rows: [['Host', 'localhost'], ['Database', 'inveniq'], ['Status', 'Connected', 'badge-success']] },
                { title: 'Security', icon: Shield, color: 'border-t-purple-500', iconColor: 'text-purple-600 dark:text-purple-400',
                  rows: [['Auth Method', 'JWT + bcrypt'], ['Token Expiry', '24 hours'], ['RBAC', 'Enabled', 'badge-success']] },
                { title: 'AI Integration', icon: Globe, color: 'border-t-emerald-500', iconColor: 'text-emerald-600 dark:text-emerald-400',
                  rows: [['Provider', 'Google Gemini'], ['Model', 'gemini-1.5-flash'], ['Status', 'Active', 'badge-success']] },
                { title: 'Scheduler', icon: Server, color: 'border-t-amber-500', iconColor: 'text-amber-600 dark:text-amber-400',
                  rows: [['Weekly Email', 'Mon 8:00 AM IST'], ['Timezone', 'Asia/Kolkata'], ['Status', 'Running', 'badge-success']] },
              ].map(card => (
                <div key={card.title} className={`card p-5 border-t-4 ${card.color}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{card.title}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    {card.rows.map(([label, value, badge]) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">{label}</span>
                        {badge ? <span className={badge}>{value}</span> : <span className="font-medium text-slate-700 dark:text-slate-300">{value}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

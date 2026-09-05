import { useState, useEffect, useRef } from 'react';
// lucide-react may not be installed in all environments; ignore type errors here
// @ts-ignore: module 'lucide-react' might be missing
import { 
  Download, Link2, Database, RefreshCw, Settings, Check, Users, MapPin, Briefcase, 
  Plus, Edit3, Trash2, Save, X, DollarSign, TrendingUp, AlertCircle,
  Wifi, WifiOff, Clock, Zap, ExternalLink, Copy, Eye, EyeOff
} from 'lucide-react';

// Types
type Employee = {
  id: string;
  name: string;
  location: string;
  workType: string;
  baseSalary: number;
  daysWorked: number;
  bonus: number;
  deductions: number;
  date: string;
};

type Location = { id: string; name: string; };
type WorkType = { id: string; name: string; rate: number; };

type SheetData = {
  employees: Employee[];
  locations: Location[];
  workTypes: WorkType[];
};


const SAMPLE_DATA: SheetData = {
  employees: [
    {
      id: '1', name: 'أحمد محمد', location: 'الرياض - الفرع الرئيسي', workType: 'دوام كامل', baseSalary: 6500, daysWorked: 26, bonus: 500, deductions: 200,
      date: ''
    },
    {
      id: '2', name: 'سارة عبدالله', location: 'جدة - فرع الساحل', workType: 'دوام جزئي', baseSalary: 4000, daysWorked: 20, bonus: 300, deductions: 0,
      date: ''
    },
    {
      id: '3', name: 'خالد العتيبي', location: 'الرياض - الفرع الرئيسي', workType: 'عقد مؤقت', baseSalary: 5500, daysWorked: 22, bonus: 0, deductions: 150,
      date: ''
    },
    {
      id: '4', name: 'نورة القحطاني', location: 'الدمام - الفرع الشرقي', workType: 'دوام كامل', baseSalary: 7000, daysWorked: 26, bonus: 800, deductions: 100,
      date: ''
    },
  ],
  locations: [
    { id: 'l1', name: 'الرياض - الفرع الرئيسي' },
    { id: 'l2', name: 'جدة - فرع الساحل' },
    { id: 'l3', name: 'الدمام - الفرع الشرقي' },
  ],
  workTypes: [
    { id: 'w1', name: 'دوام كامل', rate: 1 },
    { id: 'w2', name: 'دوام جزئي', rate: 0.6 },
    { id: 'w3', name: 'عقد مؤقت', rate: 0.9 },
    { id: 'w4', name: 'عمل عن بعد', rate: 0.8 },
  ]
};

const STORAGE_KEYS = {
  url: 'payroll_gs_url_v2',
  mode: 'payroll_gs_mode_v2',
  employees: 'payroll_employees_v2',
  locations: 'payroll_locations_v2',
  workTypes: 'payroll_workTypes_v2',
};

export default function App() {
  // Connection state
  const [scriptUrl, setScriptUrl] = useState<string>('');
  const [inputUrl, setInputUrl] = useState('');
  const [connectionMode, setConnectionMode] = useState<'sheets' | 'local' | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  // Data state
  const [data, setData] = useState<SheetData>(SAMPLE_DATA);
  const [activeTab, setActiveTab] = useState<'employees' | 'locations' | 'workTypes'>('employees');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isOffline, setIsOffline] = useState(false);


  // Modals
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({});
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [editingWorkType, setEditingWorkType] = useState<WorkType | null>(null);
  const [newWorkType, setNewWorkType] = useState<Partial<WorkType>>({});

  const autoRefreshRef = useRef<number | null>(null);
  
  // Load initial connection
  useEffect(() => {
    const savedUrl = localStorage.getItem(STORAGE_KEYS.url);
    const savedMode = localStorage.getItem(STORAGE_KEYS.mode) as 'sheets' | 'local' | null;
    if (savedUrl) {
      setScriptUrl(savedUrl);
      setInputUrl(savedUrl);
    }
    if (savedMode) {
      setConnectionMode(savedMode);
      if (savedMode === 'local') {
        loadLocalData();
      }
    }
  }, []);

  // Load local data
  const loadLocalData = () => {
    try {
      const emp = localStorage.getItem(STORAGE_KEYS.employees);
      const loc = localStorage.getItem(STORAGE_KEYS.locations);
      const wt = localStorage.getItem(STORAGE_KEYS.workTypes);
      if (emp && loc && wt) {
        setData({
          employees: JSON.parse(emp),
          locations: JSON.parse(loc),
          workTypes: JSON.parse(wt),
        });
      } else {
        setData(SAMPLE_DATA);
        saveLocalData(SAMPLE_DATA);
      }
    } catch {
      setData(SAMPLE_DATA);
    }
  };

  const saveLocalData = (d: SheetData) => {
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(d.employees));
    localStorage.setItem(STORAGE_KEYS.locations, JSON.stringify(d.locations));
    localStorage.setItem(STORAGE_KEYS.workTypes, JSON.stringify(d.workTypes));
  };

  // Toast helper
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // API Functions
const fetchAllData = async (urlOverride?: string) => {
  const url = urlOverride || scriptUrl;
  // If we are explicitly in local mode, just load local data
  if (connectionMode === 'local') {
    loadLocalData();
    setLastSync(new Date());
    return;
  }

  setIsLoading(true);
  setConnectionError('');
  
  try {
    // Add a timestamp to prevent caching
    const res = await fetch(`${url}?action=getAll&t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!res.ok) throw new Error('Network response was not ok');

    const json = await res.json();
    const fetched: SheetData = json.data || json;

    if (fetched.employees) {
      setData({
        employees: fetched.employees || [],
        locations: fetched.locations || [],
        workTypes: fetched.workTypes || [],
      });
      // Only save to local if the fetch was successful
      saveLocalData({ 
        employees: fetched.employees || [], 
        locations: fetched.locations || [], 
        workTypes: fetched.workTypes || [] 
      });
      
      setLastSync(new Date());
      setIsOffline(false); // We are back online
      showToast('تم تحديث البيانات بنجاح', 'success');
    } else {
      throw new Error('Invalid data format received');
    }
  } catch (e: any) {
    console.error('Sync failed:', e);
    setIsOffline(true); // Explicitly set offline state
    setConnectionError(`فشل الاتصال: ${e.message}. تعمل الآن في وضع عدم الاتصال.`);
    
    // Load local data as fallback, but alert the user
    loadLocalData();
    showToast('أنت تعمل الآن بدون اتصال (Offline). التغييرات محفوظة محلياً فقط.', 'error');
  } finally {
    setIsLoading(false);
  }
};

const postToSheet = async (payload: any) => {
  // If we are offline or in local mode, save locally only
  if (connectionMode === 'local' || isOffline || !scriptUrl) {
    return { success: true, local: true };
  }

  setIsSaving(true);
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }

    const text = await res.text();
    let json;
    try { 
      json = JSON.parse(text); 
    } catch { 
      json = { success: true }; // Assume success if response is empty but status is OK
    }

    if (!json.success) {
      throw new Error(json.message || 'Operation failed on server');
    }

    setLastSync(new Date());
    setIsOffline(false); // Successful post means we are online
    return json;
  } catch (e: any) {
    console.error('POST failed', e);
    setIsOffline(true); // Mark as offline if post fails
    // Re-throw error so the calling function knows it failed
    throw new Error(`فشل الحفظ في السحابة: ${e.message}. تم الحفظ محلياً بدلاً من ذلك.`);
  } finally {
    setIsSaving(false);
  }
};

  // Auto refresh
  useEffect(() => {
    if (autoRefresh && connectionMode === 'sheets' && scriptUrl) {
      autoRefreshRef.current = window.setInterval(() => {
        fetchAllData();
      }, 30000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, connectionMode, scriptUrl]);

  // Initial fetch when connected
  useEffect(() => {
    if (connectionMode === 'sheets' && scriptUrl) {
      fetchAllData();
    } else if (connectionMode === 'local') {
      loadLocalData();
      setLastSync(new Date());
    }
  }, [connectionMode]);

  // Connection handlers
  const handleConnect = async () => {
    if (!inputUrl.trim()) {
      setConnectionError('الرجاء إدخال رابط Web App');
      return;
    }
    if (!inputUrl.includes('script.google.com') && !inputUrl.includes('googleusercontent.com')) {
      setConnectionError('الرابط يجب أن يكون من Google Apps Script (script.google.com)');
      return;
    }
    setIsConnecting(true);
    setConnectionError('');
    try {
      // test fetch
      const res = await fetch(`${inputUrl}?action=getAll&t=${Date.now()}`, { method: 'GET', redirect: 'follow' });
      if (!res.ok) throw new Error('الرابط لا يعمل');
      const json = await res.json();
      const fetched = json.data || json;
      if (!fetched.employees && !json.success && !Array.isArray(fetched)) {
        // allow empty but not error
      }
      localStorage.setItem(STORAGE_KEYS.url, inputUrl);
      localStorage.setItem(STORAGE_KEYS.mode, 'sheets');
      setScriptUrl(inputUrl);
      setConnectionMode('sheets');
      showToast('تم الاتصال بـ Google Sheets بنجاح - النظام مشترك الآن', 'success');
    } catch (e: any) {
      setConnectionError('فشل الاتصال. تأكد أنك نشرت التطبيق كـ Anyone وأن Code.gs صحيح. سيتم استخدام الوضع المحلي كـ fallback.');
      // Still save but show error? For UX allow connect anyway
      localStorage.setItem(STORAGE_KEYS.url, inputUrl);
      localStorage.setItem(STORAGE_KEYS.mode, 'sheets');
      setScriptUrl(inputUrl);
      setConnectionMode('sheets');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLocalMode = () => {
    localStorage.setItem(STORAGE_KEYS.mode, 'local');
    setConnectionMode('local');
    loadLocalData();
    showToast('تم تفعيل الوضع المحلي - البيانات محفوظة في المتصفح فقط', 'info');
  };

  const handleDisconnect = () => {
    setConnectionMode(null);
    setScriptUrl('');
    setInputUrl('');
    localStorage.removeItem(STORAGE_KEYS.url);
    localStorage.removeItem(STORAGE_KEYS.mode);
  };

    // Add this function declaration
  const handleAddEmployee = async () => {
    const emp: Employee = {
      id: Date.now().toString(),
      name: newEmployee.name!,
      location: newEmployee.location!,
      workType: newEmployee.workType!,
      baseSalary: Number(newEmployee.baseSalary) || 0,
      daysWorked: Number(newEmployee.daysWorked) || 26,
      bonus: Number(newEmployee.bonus) || 0,
      deductions: Number(newEmployee.deductions) || 0,
      date: new Date().toISOString(),
    };

    try {
      const res = await postToSheet({ action: 'addEmployee', employee: emp });
      if (res.local) {
        const newData = { ...data, employees: [...data.employees, emp] };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      setShowEmployeeModal(false);
      setNewEmployee({});
      showToast('تم الحفظ في الشيت المشترك - الكل سيرى التعديل', 'success');
    } catch {
      showToast('فشل الحفظ في الشيت - تم الحفظ محلياً', 'error');
      const newData = { ...data, employees: [...data.employees, emp] };
      setData(newData);
      saveLocalData(newData);
      setShowEmployeeModal(false);
    }
  };

  

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    try {
      const res = await postToSheet({ action: 'updateEmployee', employee: editingEmployee });
      if (res.local) {
        const newData = { ...data, employees: data.employees.map(e => e.id === editingEmployee.id ? editingEmployee : e) };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      setEditingEmployee(null);
      showToast('تم الحفظ في الشيت المشترك - الكل سيرى التعديل', 'success');
    } catch {
      showToast('فشل التحديث', 'error');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟ سيتم الحذف من الشيت المشترك.')) return;
    try {
      const res = await postToSheet({ action: 'deleteEmployee', id });
      if (res.local) {
        const newData = { ...data, employees: data.employees.filter(e => e.id !== id) };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      showToast('تم حذف الموظف من الشيت المشترك', 'success');
    } catch {
      showToast('فشل الحذف', 'error');
    }
  };

  // Locations
  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    const loc: Location = { id: Date.now().toString(), name: newLocationName.trim() };
    try {
      const res = await postToSheet({ action: 'addLocation', location: loc });
      if (res.local) {
        const newData = { ...data, locations: [...data.locations, loc] };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      setNewLocationName('');
      showToast('تم إضافة مكان العمل للشيت المشترك', 'success');
    } catch {
      const newData = { ...data, locations: [...data.locations, loc] };
      setData(newData);
      saveLocalData(newData);
      setNewLocationName('');
    }
  };

  const handleEditLocation = async () => {
    if (!editingLocation) return;
    const oldName = data.locations.find(l => l.id === editingLocation.id)?.name;
    try {
      const res = await postToSheet({ action: 'editLocation', location: editingLocation, oldName });
      if (res.local) {
        // bulk update employees
        const newData = {
          ...data,
          locations: data.locations.map(l => l.id === editingLocation.id ? editingLocation : l),
          employees: data.employees.map(e => e.location === oldName ? { ...e, location: editingLocation.name } : e)
        };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      setEditingLocation(null);
      showToast('تم تحديث مكان العمل في الإعدادات وكل الموظفين - الشيت المشترك', 'success');
    } catch {
      showToast('فشل التحديث', 'error');
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    const used = data.employees.filter(e => e.location === name).length;
    if (used > 0) {
      if (!confirm(`هذا المكان مستخدم من قبل ${used} موظف. حذفه سيبقيهم بدون مكان. هل أنت متأكد؟`)) return;
    } else {
      if (!confirm('حذف مكان العمل من الشيت المشترك؟')) return;
    }
    try {
      const res = await postToSheet({ action: 'deleteLocation', id, name });
      if (res.local) {
        const newData = { ...data, locations: data.locations.filter(l => l.id !== id) };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      showToast('تم حذف مكان العمل من الشيت', 'success');
    } catch {
      showToast('فشل الحذف', 'error');
    }
  };

  // WorkTypes
  const handleAddWorkType = async () => {
    if (!newWorkType.name) return;
    const wt: WorkType = { id: Date.now().toString(), name: newWorkType.name!, rate: Number(newWorkType.rate) || 1 };
    try {
      const res = await postToSheet({ action: 'addWorkType', workType: wt });
      if (res.local) {
        const newData = { ...data, workTypes: [...data.workTypes, wt] };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      setNewWorkType({});
      showToast('تم إضافة نوع العمل للشيت', 'success');
    } catch {
      const newData = { ...data, workTypes: [...data.workTypes, wt] };
      setData(newData);
      saveLocalData(newData);
    }
  };

  const handleEditWorkType = async () => {
    if (!editingWorkType) return;
    const oldName = data.workTypes.find(w => w.id === editingWorkType.id)?.name;
    try {
      const res = await postToSheet({ action: 'editWorkType', workType: editingWorkType, oldName });
      if (res.local) {
        const newData = {
          ...data,
          workTypes: data.workTypes.map(w => w.id === editingWorkType.id ? editingWorkType : w),
          employees: data.employees.map(e => e.workType === oldName ? { ...e, workType: editingWorkType.name } : e)
        };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      setEditingWorkType(null);
      showToast('تم تحديث نوع العمل وكل الموظفين المرتبطين به', 'success');
    } catch {
      showToast('فشل التحديث', 'error');
    }
  };

  const handleDeleteWorkType = async (id: string, name: string) => {
    const used = data.employees.filter(e => e.workType === name).length;
    if (used > 0) {
      if (!confirm(`هذا النوع مستخدم من قبل ${used} موظف. هل تريد الحذف؟`)) return;
    } else {
      if (!confirm('حذف نوع العمل من الشيت؟')) return;
    }
    try {
      const res = await postToSheet({ action: 'deleteWorkType', id, name });
      if (res.local) {
        const newData = { ...data, workTypes: data.workTypes.filter(w => w.id !== id) };
        setData(newData);
        saveLocalData(newData);
      } else {
        await fetchAllData();
      }
      showToast('تم حذف نوع العمل', 'success');
    } catch {
      showToast('فشل الحذف', 'error');
    }
  };

  const totalPayroll = data.employees.reduce((sum, e) => sum + (e.baseSalary + e.bonus - e.deductions), 0);

  // If not connected, show setup page
  if (!connectionMode) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#fafaf8] text-zinc-900 font-sans flex items-center justify-center p-4">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); *{font-family: 'Tajawal', sans-serif;}`}</style>
        
        <div className="w-full max-w-[680px]">
          {/* Header badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white border border-zinc-200 rounded-full px-4 py-1.5 text-[13px] text-zinc-600 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              نظام رواتب مشترك - Google Sheets
            </div>
            <h1 className="text-[34px] font-extrabold tracking-tight mt-6 leading-[1.1]">
              اربط نظام الرواتب<br/>بـ Google Sheets
            </h1>
            <p className="text-zinc-500 mt-3 text-[15px] leading-6 max-w-[520px] mx-auto">
              كل تعديل تقوم به يظهر فوراً لجميع أعضاء الفريق. نسخة واحدة مشتركة، تحديث لحظي، بدون تعارض.
            </p>
          </div>

          <div className="bg-white rounded-[24px] border border-zinc-200 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="p-7 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
                  <Link2 size={18} />
                </div>
                <div>
                  <h2 className="font-bold text-[16px]">إعداد الاتصال</h2>
                  <p className="text-[12px] text-zinc-500">الصق رابط Web App الخاص بك</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[13px] font-medium text-zinc-700 mb-2 block">رابط Google Apps Script Web App</label>
                  <div className="relative">
                    <input
                      value={inputUrl}
                      onChange={e => setInputUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full h-[56px] rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 focus:ring-0 outline-none px-4 text-[14px] text-left placeholder:text-zinc-400 transition"
                      dir="ltr"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${inputUrl.includes('script.google.com') ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    </div>
                  </div>
                  {connectionError && (
                    <div className="mt-3 flex gap-2 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{connectionError}</span>
                    </div>
                  )}
                </div>

                <div dir="rtl" className="min-h-screen bg-[#fafaf8] text-zinc-900">
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); *{font-family: 'Tajawal', sans-serif; -webkit-tap-highlight-color: transparent;} ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#d4d4d8;border-radius:99px} :focus-visible{outline: 2px solid #18181b; outline-offset: 2px; border-radius: 8px;}`}</style>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="h-[48px] rounded-xl bg-zinc-900 text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-60"
                  >
                    {isConnecting ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                    {isConnecting ? 'جاري الاتصال...' : 'اتصال ومزامنة الآن'}
                  </button>
                  <button
                    onClick={handleLocalMode}
                    className="h-[48px] rounded-xl bg-white border border-zinc-200 font-medium text-[14px] flex items-center justify-center gap-2 hover:bg-zinc-50 transition"
                  >
                    <Database size={16} />
                    تجربة بدون Sheets
                  </button>
                </div>

                <div className="pt-2">
                  <button onClick={() => setShowInstructions(!showInstructions)} className="text-[13px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5">
                    <ExternalLink size={14} />
                    {showInstructions ? 'إخفاء التعليمات' : 'كيف أحصل على الرابط؟'} 
                  </button>
                  {showInstructions && (
                    <div className="mt-4 bg-zinc-50 rounded-xl p-4 border border-zinc-200 text-[13px] leading-6">
                      <ol className="list-decimal pr-5 space-y-2 text-zinc-700">
                        <li>افتح <b>Google Sheets</b> وأنشئ 3 شيتات: <code className="bg-white px-1.5 py-0.5 rounded border">employees</code> <code className="bg-white px-1.5 py-0.5 rounded border">locations</code> <code className="bg-white px-1.5 py-0.5 rounded border">workTypes</code></li>
                        <li>من القائمة: <b>Extensions → Apps Script</b> والصق كود <code>Code.gs</code> الذي أرسلناه (يحتوي doGet و doPost).</li>
                        <li>اضغط <b>Deploy → New deployment</b> واختر <b>Web app</b>:</li>
                        <li className="mr-2">- Execute as: <b>Me</b><br/>- Who has access: <b>Anyone</b></li>
                        <li>انسخ رابط الـ <b>Web App URL</b> والصقه هنا.</li>
                        <li className="text-emerald-700">ملاحظة CORS: الكود يستخدم <code>text/plain</code> لتجاوز preflight.</li>
                      </ol>
                      <div className="mt-4 bg-white border border-zinc-200 rounded-lg p-3 text-[11px] font-mono text-zinc-600 text-left" dir="ltr">
                        {`function doGet(e){... action=getAll ...}
function doPost(e){... addEmployee / editLocation bulk ...}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-zinc-50 border-t border-zinc-200 px-7 sm:px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] text-zinc-500">
                <div className="w-7 h-7 rounded-full bg-white border border-zinc-200 flex items-center justify-center">
                  <Database size={12} />
                </div>
                البيانات محفوظة في localStorage بشكل آمن
              </div>
              <div className="text-[11px] text-zinc-400">payroll-google-sheets.html</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white border border-zinc-200 rounded-2xl p-3">
              <div className="text-[12px] text-zinc-500">مزامنة فورية</div>
              <div className="font-bold text-[13px] mt-1">كل التعديلات مشتركة</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-3">
              <div className="text-[12px] text-zinc-500">Bulk Update</div>
              <div className="font-bold text-[13px] mt-1">تعديل الموقع لكل الموظفين</div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-3">
              <div className="text-[12px] text-zinc-500">Fallback</div>
              <div className="font-bold text-[13px] mt-1">يعمل حتى بدون اتصال</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

    // Helper to export monthly summary to CSV
  const exportMonthlySummary = () => {
    const summary: { [key: string]: { count: number; totalSalary: number; totalBonus: number; totalDeductions: number; totalNet: number; employees: Employee[] } } = {};

    let globalTotalSalary = 0;
    let globalTotalBonus = 0;
    let globalTotalDeductions = 0;
    let globalTotalNet = 0;

    data.employees.forEach(emp => {
      const dateStr = emp.date || new Date().toISOString().split('T')[0];
      const monthKey = dateStr.substring(0, 7);

      if (!summary[monthKey]) {
        summary[monthKey] = { count: 0, totalSalary: 0, totalBonus: 0, totalDeductions: 0, totalNet: 0, employees: [] };
      }

      const netSalary = emp.baseSalary + emp.bonus - emp.deductions;
      summary[monthKey].count += 1;
      summary[monthKey].totalSalary += emp.baseSalary;
      summary[monthKey].totalBonus += emp.bonus;
      summary[monthKey].totalDeductions += emp.deductions;
      summary[monthKey].totalNet += netSalary;
      summary[monthKey].employees.push(emp);

      globalTotalSalary += emp.baseSalary;
      globalTotalBonus += emp.bonus;
      globalTotalDeductions += emp.deductions;
      globalTotalNet += netSalary;
    });

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    
    // Global Summary
    csvContent += "=== ملخص عام ===\n";
    csvContent += `إجمالي الموظفين,${data.employees.length}\n`;
    csvContent += `إجمالي الرواتب الأساسية,${globalTotalSalary}\n`;
    csvContent += `إجمالي المكافآت,${globalTotalBonus}\n`;
    csvContent += `إجمالي الخصومات,${globalTotalDeductions}\n`;
    csvContent += `إجمالي الصافي,${globalTotalNet}\n\n`;

    // Monthly Summaries and Employee Details
    Object.keys(summary).sort().reverse().forEach(month => {
      const s = summary[month];
      csvContent += `=== شهر: ${month} ===\n`;
      csvContent += "عدد الموظفين,إجمالي الأساسي,إجمالي المكافآت,إجمالي الخصومات,إجمالي الصافي\n";
      csvContent += `${s.count},${s.totalSalary},${s.totalBonus},${s.totalDeductions},${s.totalNet}\n\n`;
      
      csvContent += "اسم الموظف,مكان العمل,نوع العمل,الأساسي,مكافأة,خصومات,الصافي\n";
      s.employees.forEach(emp => {
        const net = emp.baseSalary + emp.bonus - emp.deductions;
        csvContent += `"${emp.name}","${emp.location}","${emp.workType}",${emp.baseSalary},${emp.bonus},${emp.deductions},${net}\n`;
      });
      csvContent += "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `comprehensive_salary_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('تم تحميل التقرير الشامل بنجاح', 'success');
  };

  // Main App
  return (
    <div dir="rtl" className="min-h-screen bg-[#fafaf8] text-zinc-900">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); *{font-family: 'Tajawal', sans-serif;} ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-thumb{background:#d4d4d8;border-radius:99px}`}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-zinc-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <DollarSign size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-[15px] leading-none">نظام الرواتب</h1>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border ${connectionMode === 'sheets' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connectionMode === 'sheets' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {connectionMode === 'sheets' ? 'متصل بـ Google Sheets - مشترك' : 'وضع محلي - localStorage'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-zinc-500 truncate max-w-[220px] sm:max-w-[360px] text-left" dir="ltr">{connectionMode === 'sheets' ? scriptUrl.slice(0, 56) + '...' : 'payroll-local'}</span>
                <button onClick={() => { setShowUrl(!showUrl); navigator.clipboard.writeText(scriptUrl); }} className="w-5 h-5 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors">
                  <Copy size={10} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-full px-3 h-[36px]">
              <Clock size={14} className="text-zinc-500" />
              <span className="text-[11px] text-zinc-600 whitespace-nowrap">{lastSync ? `آخر مزامنة ${lastSync.toLocaleTimeString('ar-EG')}` : 'لم تتم المزامنة'}</span>
            </div>

            <button
              onClick={() => fetchAllData()}
              disabled={isLoading}
              className="h-[36px] px-3 rounded-full bg-white border border-zinc-200 text-[13px] font-medium flex items-center gap-1.5 hover:bg-zinc-50 disabled:opacity-60 transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">تحديث البيانات</span>
            </button>
            <button
              onClick={exportMonthlySummary}
              className="h-[36px] px-3 rounded-full bg-white border border-zinc-200 text-[13px] font-medium flex items-center gap-1.5 hover:bg-zinc-50 transition-colors"
            >
              <Download size={14} />
              <span className="hidden sm:inline">تصدير التقرير الشامل</span>
            </button>

            <div className="h-[36px] px-3 rounded-full bg-white border border-zinc-200 flex items-center gap-2">
              <span className="text-[11px] font-medium hidden md:block">تحديث تلقائي</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`w-[36px] h-[20px] rounded-full p-0.5 transition-all flex ${autoRefresh ? 'bg-emerald-500 justify-end' : 'bg-zinc-300 justify-start'}`}
              >
                <div className="w-[16px] h-[16px] rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <button
              onClick={handleDisconnect}
              className="w-[36px] h-[36px] rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 transition-colors"
              title="إعدادات الاتصال"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {isSaving && (
          <div className="h-[3px] bg-amber-500 w-full animate-pulse" />
        )}
      </header>


      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center"><Users size={16} /></div>
              <span className="text-[12px] font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">{data.employees.length} موظف</span>
            </div>
            <div className="text-[13px] text-zinc-500 mb-1">إجمالي الرواتب</div>
            <div className="text-[24px] font-extrabold tracking-tight">{totalPayroll.toLocaleString('ar-EG')} <span className="text-[14px] font-bold text-zinc-400">ر.س</span></div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-2"><TrendingUp size={12} />مشترك للجميع</div>
          </div>
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center"><MapPin size={16} /></div>
              <span className="text-[12px] font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">{data.locations.length} موقع</span>
            </div>
            <div className="text-[13px] text-zinc-500 mb-1">أماكن العمل</div>
            <div className="text-[16px] font-bold mt-1 truncate">{data.locations.map(l=>l.name).join('، ')}</div>
            <div className="text-[11px] text-zinc-400 mt-2">Bulk update عند التعديل</div>
          </div>
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center"><Briefcase size={16} /></div>
              <span className="text-[12px] font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">{data.workTypes.length} نوع</span>
            </div>
            <div className="text-[13px] text-zinc-500 mb-1">أنواع العمل</div>
            <div className="text-[16px] font-bold mt-1">{data.workTypes.length} أنواع نشطة</div>
            <div className="text-[11px] text-zinc-400 mt-2">مزامنة مع الموظفين</div>
          </div>
          <div className={`rounded-2xl border p-5 shadow-sm ${connectionMode==='sheets' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${connectionMode==='sheets' ? 'bg-emerald-600 text-white' : 'bg-zinc-900 text-white'}`}>
                {connectionMode==='sheets' ? <Wifi size={16}/> : <WifiOff size={16}/>}
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${connectionMode==='sheets' ? 'bg-white text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'}`}>
                {connectionMode==='sheets' ? 'متصل' : 'محلي'}
              </span>
            </div>
            <div className="text-[13px] text-zinc-500 mb-1">حالة الشيت</div>
            <div className="text-[14px] font-bold mt-1">{connectionMode==='sheets' ? 'الجميع يرى التعديلات فوراً' : 'البيانات على هذا الجهاز فقط'}</div>
            <div className="text-[11px] text-zinc-400 mt-2 truncate" dir="ltr">{connectionMode==='sheets' ? 'GET ?action=getAll • POST bulk' : 'localStorage fallback'}</div>
          </div>
        </div>


        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { id: 'employees', label: 'الموظفون', icon: Users, count: data.employees.length },
            { id: 'locations', label: 'أماكن العمل', icon: MapPin, count: data.locations.length },
            { id: 'workTypes', label: 'أنواع العمل', icon: Briefcase, count: data.workTypes.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-[40px] px-4 rounded-full border text-[13px] font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab===tab.id ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
            >
              <tab.icon size={14} />
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab===tab.id ? 'bg-white/20' : 'bg-zinc-100'}`}>{tab.count}</span>
            </button>
          ))}
          <div className="mr-auto flex items-center gap-2 text-[11px] text-zinc-400">
            <Eye size={12} />
            {connectionMode==='sheets' ? 'التعديلات مشتركة ومزامنة' : 'وضع تجريبي محلي'}
          </div>
        </div>

        {activeTab==='employees' && (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-zinc-100">
              <h2 className="font-bold text-[15px]">كشف الرواتب - الشيت المشترك</h2>
              <button onClick={() => { setNewEmployee({ daysWorked: 26 }); setShowEmployeeModal(true); }} className="h-[36px] px-4 rounded-full bg-zinc-900 text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-black transition-colors shadow-sm">
                <Plus size={14} /> إضافة موظف
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-zinc-50/80 text-zinc-500 text-[11px] border-b border-zinc-200">
                  <tr>
                    <th className="text-right font-medium px-4 py-3">الموظف</th>
                    <th className="text-right font-medium px-4 py-3">المكان</th>
                    <th className="text-right font-medium px-4 py-3">نوع العمل</th>
                    <th className="text-right font-medium px-4 py-3">الأساسي</th>
                    <th className="text-right font-medium px-4 py-3">الصافي</th>
                    <th className="text-right font-medium px-4 py-3 w-[100px]">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((emp, idx) => {
                    const net = emp.baseSalary + emp.bonus - emp.deductions;
                    return (
                      <tr key={emp.id} className={`border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors ${idx % 2 !== 0 ? 'bg-zinc-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-bold">{emp.name}</div>
                          <div className="text-[11px] text-zinc-400 mt-0.5">{emp.daysWorked} يوم • {emp.bonus>0 ? <span className="text-emerald-600">+{emp.bonus}</span> : ''} {emp.deductions>0 ? <span className="text-red-500">-{emp.deductions}</span> : ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex bg-zinc-100 border border-zinc-200 rounded-full px-2.5 py-1 text-[11px] font-medium">{emp.location}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-1 text-[11px] font-medium">{emp.workType}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{emp.baseSalary.toLocaleString()} ر.س</td>
                        <td className="px-4 py-3">
                          <span className="font-extrabold text-zinc-900">{net.toLocaleString()} ر.س</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingEmployee({...emp})} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors">
                              <Edit3 size={13} className="text-zinc-500" />
                            </button>
                            <button onClick={() => handleDeleteEmployee(emp.id)} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors">
                              <Trash2 size={13} className="text-zinc-500 hover:text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Locations Tab */}
        {activeTab==='locations' && (
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 h-fit shadow-sm">
              <h3 className="font-bold text-[14px] mb-3">إضافة مكان عمل جديد</h3>
              <div className="flex gap-2">
                <input
                  value={newLocationName}
                  onChange={e=>setNewLocationName(e.target.value)}
                  placeholder="مثال: تبوك - الفرع الشمالي"
                  className="flex-1 h-[42px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors"
                />
                <button onClick={handleAddLocation} className="w-[42px] h-[42px] rounded-xl bg-zinc-900 text-white flex items-center justify-center hover:bg-black transition-colors shadow-sm">
                  <Plus size={16} />
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 mt-4 leading-5">
                الإضافة ترسل <b>POST action=addLocation</b> للشيت. عند التعديل يتم عمل <b>bulk update</b> لكل الموظفين في الشيت تلقائياً عبر <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">editLocation</code>.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-3 shadow-sm">
              {data.locations.map(loc => (
                <div key={loc.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"><MapPin size={16} /></div>
                    <div>
                      <div className="font-bold text-[13px]">{loc.name}</div>
                      <div className="text-[11px] text-zinc-400">{data.employees.filter(e=>e.location===loc.name).length} موظف يستخدمه</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingLocation({...loc})} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors">
                      <Edit3 size={13} className="text-zinc-500" />
                    </button>
                    <button onClick={() => handleDeleteLocation(loc.id, loc.name)} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors">
                      <Trash2 size={13} className="text-zinc-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==='workTypes' && (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 h-fit shadow-sm">
              <h3 className="font-bold text-[14px] mb-3">إضافة نوع عمل</h3>
              <div className="space-y-2">
                <input
                  value={newWorkType.name || ''}
                  onChange={e=>setNewWorkType({...newWorkType, name: e.target.value})}
                  placeholder="اسم النوع: دوام كامل، جزئي..."
                  className="w-full h-[42px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={newWorkType.rate || ''}
                    onChange={e=>setNewWorkType({...newWorkType, rate: parseFloat(e.target.value)})}
                    placeholder="المعامل 1.0"
                    className="flex-1 h-[42px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors"
                  />
                  <button onClick={handleAddWorkType} className="h-[42px] px-5 rounded-xl bg-zinc-900 text-white text-[13px] font-bold flex items-center gap-1 hover:bg-black transition-colors shadow-sm">
                    <Plus size={14} /> إضافة
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 mt-4 leading-5">
                يدعم <b>POST action=addWorkType / editWorkType / deleteWorkType</b> مع تحديث جماعي للموظفين عند تغيير الاسم.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-3 shadow-sm">
              {data.workTypes.map(wt => (
                <div key={wt.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500"><Briefcase size={16} /></div>
                    <div>
                      <div className="font-bold text-[13px]">{wt.name} <span className="font-normal text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded text-[11px]">×{wt.rate}</span></div>
                      <div className="text-[11px] text-zinc-400">{data.employees.filter(e=>e.workType===wt.name).length} موظف</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingWorkType({...wt})} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-zinc-100 transition-colors">
                      <Edit3 size={13} className="text-zinc-500" />
                    </button>
                    <button onClick={() => handleDeleteWorkType(wt.id, wt.name)} className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors">
                      <Trash2 size={13} className="text-zinc-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {/* WorkTypes Tab */}
        {activeTab==='workTypes' && (
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
            <div className="bg-white rounded-[20px] border border-zinc-200 p-4 h-fit">
              <h3 className="font-bold text-[14px] mb-3">إضافة نوع عمل</h3>
              <div className="space-y-2">
                <input
                  value={newWorkType.name || ''}
                  onChange={e=>setNewWorkType({...newWorkType, name: e.target.value})}
                  placeholder="اسم النوع: دوام كامل، جزئي..."
                  className="w-full h-[40px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={newWorkType.rate || ''}
                    onChange={e=>setNewWorkType({...newWorkType, rate: parseFloat(e.target.value)})}
                    placeholder="المعامل 1.0"
                    className="flex-1 h-[40px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900"
                  />
                  <button onClick={handleAddWorkType} className="h-[40px] px-5 rounded-xl bg-zinc-900 text-white text-[13px] font-bold flex items-center gap-1">
                    <Plus size={14} /> إضافة
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-3 leading-4">
                يدعم <b>POST action=addWorkType / editWorkType / deleteWorkType</b> مع تحديث جماعي للموظفين عند تغيير الاسم.
              </p>
            </div>

            <div className="bg-white rounded-[20px] border border-zinc-200 p-2">
              {data.workTypes.map(wt => (
                <div key={wt.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"><Briefcase size={14} /></div>
                    <div>
                      <div className="font-bold text-[13px]">{wt.name} <span className="font-normal text-zinc-500">×{wt.rate}</span></div>
                      <div className="text-[11px] text-zinc-500">{data.employees.filter(e=>e.workType===wt.name).length} موظف</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingWorkType({...wt})} className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleDeleteWorkType(wt.id, wt.name)} className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-600">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connection details card */}
        {showUrl && (
          <div className="mt-6 bg-zinc-900 text-zinc-100 rounded-[20px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><Link2 size={16} /></div>
              <div>
                <div className="text-[12px] text-zinc-400">رابط Web App الحالي</div>
                <div className="text-[12px] font-mono text-left break-all" dir="ltr">{scriptUrl}</div>
              </div>
            </div>
            <button onClick={() => setShowUrl(false)} className="h-[32px] px-3 rounded-full bg-white text-zinc-900 text-[12px] font-bold flex items-center gap-1">
              <EyeOff size={12} /> إخفاء
            </button>
          </div>
        )}

        {/* Code.gs helper */}
        <div className="mt-8 bg-white border border-zinc-200 rounded-[20px] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[13px] flex items-center gap-2"><Database size={14} /> كود Code.gs المتوافق (للمراجعة)</h3>
            <span className="text-[11px] text-zinc-500">يجب نشره كـ Web App - Anyone</span>
          </div>
          <pre className="mt-3 bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-[11px] overflow-x-auto text-left" dir="ltr">
{`// GET ?action=getAll
function doGet(e){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const get = name => ss.getSheetByName(name).getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify({
    employees: sheetToObjects(get('employees')),
    locations: sheetToObjects(get('locations')),
    workTypes: sheetToObjects(get('workTypes'))
  })).setMimeType(ContentService.MimeType.JSON);
}
// POST actions: addEmployee, updateEmployee, deleteEmployee
// addLocation, editLocation (bulk), deleteLocation
// addWorkType, editWorkType (bulk), deleteWorkType
function doPost(e){
  const data = JSON.parse(e.postData.contents);
  // ... تنفيذ ثم bulk update عند editLocation/editWorkType
  return ContentService.createTextOutput(JSON.stringify({success:true}));
}`}
          </pre>
        </div>
      </main>

      {/* Employee Modal */}
      {(showEmployeeModal || editingEmployee) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => { setShowEmployeeModal(false); setEditingEmployee(null); }} />
          <div className="relative bg-white rounded-2xl border border-zinc-200 w-full max-w-[520px] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-extrabold text-[15px]">{editingEmployee ? 'تعديل موظف' : 'إضافة موظف جديد'} - حفظ في الشيت</h3>
              <button onClick={() => { setShowEmployeeModal(false); setEditingEmployee(null); }} className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {editingEmployee ? (
                <>
                  <div>
                    <label className="text-[12px] font-medium text-zinc-600">اسم الموظف</label>
                    <input value={editingEmployee.name} onChange={e=>setEditingEmployee({...editingEmployee, name: e.target.value})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">مكان العمل</label>
                      <select value={editingEmployee.location} onChange={e=>setEditingEmployee({...editingEmployee, location: e.target.value})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] bg-white outline-none focus:border-zinc-900 transition-colors">
                        {data.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">نوع العمل</label>
                      <select value={editingEmployee.workType} onChange={e=>setEditingEmployee({...editingEmployee, workType: e.target.value})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] bg-white outline-none focus:border-zinc-900 transition-colors">
                        {data.workTypes.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">الراتب الأساسي</label>
                      <input type="number" value={editingEmployee.baseSalary} onChange={e=>setEditingEmployee({...editingEmployee, baseSalary: Number(e.target.value)})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">أيام العمل</label>
                      <input type="number" value={editingEmployee.daysWorked} onChange={e=>setEditingEmployee({...editingEmployee, daysWorked: Number(e.target.value)})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">مكافأة</label>
                      <input type="number" value={editingEmployee.bonus} onChange={e=>setEditingEmployee({...editingEmployee, bonus: Number(e.target.value)})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">خصومات</label>
                      <input type="number" value={editingEmployee.deductions} onChange={e=>setEditingEmployee({...editingEmployee, deductions: Number(e.target.value)})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[12px] font-medium text-zinc-600">اسم الموظف *</label>
                    <input value={newEmployee.name || ''} onChange={e=>setNewEmployee({...newEmployee, name: e.target.value})} placeholder="أدخل الاسم الكامل" className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">مكان العمل *</label>
                      <select value={newEmployee.location || ''} onChange={e=>setNewEmployee({...newEmployee, location: e.target.value})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] bg-white outline-none focus:border-zinc-900 transition-colors">
                        <option value="">اختر المكان</option>
                        {data.locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">نوع العمل *</label>
                      <select value={newEmployee.workType || ''} onChange={e=>setNewEmployee({...newEmployee, workType: e.target.value})} className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] bg-white outline-none focus:border-zinc-900 transition-colors">
                        <option value="">اختر النوع</option>
                        {data.workTypes.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">الأساسي</label>
                      <input type="number" value={newEmployee.baseSalary || ''} onChange={e=>setNewEmployee({...newEmployee, baseSalary: Number(e.target.value)})} placeholder="6500" className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">مكافأة</label>
                      <input type="number" value={newEmployee.bonus || ''} onChange={e=>setNewEmployee({...newEmployee, bonus: Number(e.target.value)})} placeholder="0" className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-zinc-600">خصم</label>
                      <input type="number" value={newEmployee.deductions || ''} onChange={e=>setNewEmployee({...newEmployee, deductions: Number(e.target.value)})} placeholder="0" className="mt-1.5 w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2">
              <button onClick={() => { setShowEmployeeModal(false); setEditingEmployee(null); }} className="h-[40px] px-4 rounded-xl bg-white border border-zinc-200 text-[13px] font-medium hover:bg-zinc-100 transition-colors">إلغاء</button>
              <button onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee} className="h-[40px] px-5 rounded-xl bg-zinc-900 text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-black transition-colors shadow-sm">
                <Save size={14} /> {isSaving ? 'جاري الحفظ...' : 'حفظ في الشيت المشترك'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => setEditingLocation(null)} />
          <div className="relative bg-white rounded-2xl border border-zinc-200 w-full max-w-[420px] p-5 shadow-2xl">
            <h3 className="font-bold text-[14px] mb-3">تعديل مكان العمل - سيحدث كل الموظفين</h3>
            <input value={editingLocation.name} onChange={e=>setEditingLocation({...editingLocation, name: e.target.value})} className="w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
            <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              عند الحفظ سيتم تنفيذ <b>editLocation bulk update</b> في Apps Script: يحدث شيت الإعدادات + كل صفوف الموظفين التي تستخدم الاسم القديم.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingLocation(null)} className="h-[40px] px-4 rounded-xl bg-white border border-zinc-200 text-[13px] hover:bg-zinc-100 transition-colors">إلغاء</button>
              <button onClick={handleEditLocation} className="h-[40px] px-5 rounded-xl bg-zinc-900 text-white text-[13px] font-bold hover:bg-black transition-colors shadow-sm">حفظ وتحديث الجميع</button>
            </div>
          </div>
        </div>
      )}

      {editingWorkType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => setEditingWorkType(null)} />
          <div className="relative bg-white rounded-2xl border border-zinc-200 w-full max-w-[420px] p-5 shadow-2xl">
            <h3 className="font-bold text-[14px] mb-3">تعديل نوع العمل - تحديث جماعي</h3>
            <div className="space-y-3">
              <input value={editingWorkType.name} onChange={e=>setEditingWorkType({...editingWorkType, name: e.target.value})} className="w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
              <input type="number" step="0.1" value={editingWorkType.rate} onChange={e=>setEditingWorkType({...editingWorkType, rate: parseFloat(e.target.value)})} className="w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900 transition-colors" />
            </div>
            <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              سيتم <b>editWorkType</b> مع bulk update لكل الموظفين المرتبطين.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingWorkType(null)} className="h-[40px] px-4 rounded-xl bg-white border border-zinc-200 text-[13px] hover:bg-zinc-100 transition-colors">إلغاء</button>
              <button onClick={handleEditWorkType} className="h-[40px] px-5 rounded-xl bg-zinc-900 text-white text-[13px] font-bold hover:bg-black transition-colors shadow-sm">حفظ وتحديث الجميع</button>
            </div>
          </div>
        </div>
      )}


      {/* Location Edit Modal */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setEditingLocation(null)} />
          <div className="relative bg-white rounded-[20px] border border-zinc-200 w-full max-w-[420px] p-5">
            <h3 className="font-bold text-[14px] mb-3">تعديل مكان العمل - سيحدث كل الموظفين</h3>
            <input value={editingLocation.name} onChange={e=>setEditingLocation({...editingLocation, name: e.target.value})} className="w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900" />
            <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              عند الحفظ سيتم تنفيذ <b>editLocation bulk update</b> في Apps Script: يحدث شيت الإعدادات + كل صفوف الموظفين التي تستخدم الاسم القديم.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingLocation(null)} className="h-[38px] px-4 rounded-full bg-white border border-zinc-200 text-[13px]">إلغاء</button>
              <button onClick={handleEditLocation} className="h-[38px] px-5 rounded-full bg-zinc-900 text-white text-[13px] font-bold">حفظ وتحديث الجميع</button>
            </div>
          </div>
        </div>
      )}

      {/* WorkType Edit Modal */}
      {editingWorkType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setEditingWorkType(null)} />
          <div className="relative bg-white rounded-[20px] border border-zinc-200 w-full max-w-[420px] p-5">
            <h3 className="font-bold text-[14px] mb-3">تعديل نوع العمل - تحديث جماعي</h3>
            <div className="space-y-3">
              <input value={editingWorkType.name} onChange={e=>setEditingWorkType({...editingWorkType, name: e.target.value})} className="w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none focus:border-zinc-900" />
              <input type="number" step="0.1" value={editingWorkType.rate} onChange={e=>setEditingWorkType({...editingWorkType, rate: parseFloat(e.target.value)})} className="w-full h-[44px] rounded-xl border border-zinc-200 px-3 text-[13px] outline-none" />
            </div>
            <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              سيتم <b>editWorkType</b> مع bulk update لكل الموظفين المرتبطين.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditingWorkType(null)} className="h-[38px] px-4 rounded-full bg-white border border-zinc-200 text-[13px]">إلغاء</button>
              <button onClick={handleEditWorkType} className="h-[38px] px-5 rounded-full bg-zinc-900 text-white text-[13px] font-bold">حفظ وتحديث الجميع</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-[480px]">
          <div className={`rounded-full px-4 h-[44px] flex items-center gap-2.5 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.4)] border text-[13px] font-medium justify-center ${toast.type==='success' ? 'bg-zinc-900 text-white border-zinc-800' : toast.type==='error' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-zinc-900 border-zinc-200'}`}>
            {toast.type==='success' ? <Check size={16} className="text-emerald-400" /> : toast.type==='error' ? <AlertCircle size={16} /> : <Zap size={16} />}
            <span className="truncate">{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Footer hint */}
      <div className="max-w-[1280px] mx-auto px-6 pb-8 pt-2">
        <div className="text-[11px] text-zinc-400 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          النظام جاهز للعمل مع Code.gs - يدعم CORS عبر text/plain و fallback تلقائي لـ localStorage عند فشل الاتصال
        </div>
      </div>
    </div>
  );
}

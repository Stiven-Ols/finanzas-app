import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, Timestamp, onSnapshot, arrayUnion } from 'firebase/firestore'; 
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { 
    Sun, Moon, PlusCircle, Edit3, Trash2, TrendingUp, TrendingDown, Repeat, Landmark, Users, Home, List,
    Filter as FilterIcon, Settings, LogOut, CreditCard, CalendarDays, AlertTriangle, Info, CheckCircle, 
    ChevronDown, ChevronUp, DollarSign, BarChart2, PieChart as PieChartIcon, FileText, ShieldQuestion, 
    XCircle, Menu, Search, Tag, Coins, Target, PiggyBank, Gift, Car, Plane, Briefcase, GraduationCap, 
    ShoppingBag, CircleDollarSign, TrendingUp as TrendingUpIcon, Check, Save, Wallet, Archive, ListChecks, 
    PackagePlus, Download, ArrowRightCircle, Edit, AlertOctagon
} from 'lucide-react';

// Firebase Configuration
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY", 
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// App ID
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Theme Context ---
const ThemeContext = createContext();
const useTheme = () => useContext(ThemeContext);

const THEME_COLORS = {
  light: {
    background: 'bg-slate-100', card: 'bg-white', textPrimary: 'text-slate-900', textSecondary: 'text-slate-700',
    primaryAccent: 'cyan', secondaryAccent: 'pink', border: 'border-slate-300', inputBg: 'bg-white',
    inputBorder: 'border-slate-400', hoverBg: 'hover:bg-slate-200', chartGrid: '#CBD5E1', chartText: '#475569',
    avatarBg: 'bg-cyan-500', avatarText: 'text-white',
  },
  dark: {
    background: 'bg-slate-950', card: 'bg-slate-800', textPrimary: 'text-slate-50', textSecondary: 'text-slate-300',
    primaryAccent: 'cyan', secondaryAccent: 'pink', border: 'border-slate-700', inputBg: 'bg-slate-700',
    inputBorder: 'border-slate-600', hoverBg: 'hover:bg-slate-700', chartGrid: '#475569', chartText: '#94A3B8',
    avatarBg: 'bg-cyan-400', avatarText: 'text-slate-900',
  }
};

const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);
    const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    return <ThemeContext.Provider value={{ theme, toggleTheme, colors: THEME_COLORS[theme] }}>{children}</ThemeContext.Provider>;
};

// --- Settings Context ---
const SettingsContext = createContext();
const useSettings = () => useContext(SettingsContext);

const SUPPORTED_CURRENCIES = {
    COP: { symbol: '$', locale: 'es-CO', name: 'Peso Colombiano (COP)', code: 'COP' },
    USD: { symbol: '$', locale: 'en-US', name: 'Dólar Estadounidense (USD)', code: 'USD' },
    EUR: { symbol: '€', locale: 'de-DE', name: 'Euro (EUR)', code: 'EUR' },
};

const CustomCategoriesContext = createContext();
const useCustomCategories = () => useContext(CustomCategoriesContext);

const CustomCategoriesProvider = ({ children }) => {
    const [customCategories, setCustomCategories] = useState(() => {
        const saved = localStorage.getItem('customCategoriesFinPro');
        return saved ? JSON.parse(saved) : [];
    });

    const addCustomCategory = (newCategory) => {
        if (newCategory && !customCategories.includes(newCategory)) {
            const updatedCategories = [...customCategories, newCategory];
            setCustomCategories(updatedCategories);
            localStorage.setItem('customCategoriesFinPro', JSON.stringify(updatedCategories));
        }
    };
    // Placeholder for remove/edit, more complex due to usage in transactions/budgets
    // const removeCustomCategory = (categoryToRemove) => { ... };
    // const editCustomCategory = (oldCategory, newCategory) => { ... };

    return (
        <CustomCategoriesContext.Provider value={{ customCategories, addCustomCategory }}>
            {children}
        </CustomCategoriesContext.Provider>
    );
};


const SettingsProvider = ({ children }) => {
    const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'COP');
    useEffect(() => { localStorage.setItem('currency', currency); }, [currency]);
    const value = useMemo(() => ({
        currency, setCurrency,
        currencyConfig: SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.COP,
    }), [currency]);

    return (
      <CustomCategoriesProvider>
        <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
      </CustomCategoriesProvider>
    );
};


// --- Helper Functions ---
const formatDate = (dateInput, type = 'iso') => { 
    if (!dateInput) return ''; let dateObj;
    if (dateInput instanceof Timestamp) dateObj = dateInput.toDate();
    else if (dateInput instanceof Date) dateObj = dateInput;
    else if (typeof dateInput === 'string') {
        if (dateInput.includes('T')) dateObj = new Date(dateInput);
        else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) dateObj = new Date(dateInput + "T00:00:00");
        else dateObj = new Date(dateInput);
    } else return '';

    if (!dateObj || isNaN(dateObj.getTime())) return '';

    if (type === 'descriptive') {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return dateObj.toLocaleDateString('es-ES', options); 
    }
    return dateObj.toISOString().split('T')[0]; 
};

const formatCurrencyDisplay = (value, currencyConfig) => {
    if (!currencyConfig || !currencyConfig.symbol || !currencyConfig.locale) {
        const fallbackSymbol = currencyConfig?.symbol || '$'; 
        return typeof value === 'number' && !isNaN(value) ? `${fallbackSymbol}${value.toFixed(0)}` : `${fallbackSymbol}0`; 
    }
    if (typeof value !== 'number' || isNaN(value)) return `${currencyConfig.symbol}0`;
    
    let numberFormatted = value.toLocaleString(currencyConfig.locale, {
        minimumFractionDigits: (value % 1 === 0) ? 0 : 2, 
        maximumFractionDigits: 2
    });

    return `${currencyConfig.symbol}${numberFormatted}`;
};


const calculateNextPaymentDate = (startDateStr, billingCycle) => {
    if (!startDateStr || !billingCycle) return null;
    const startDateObj = new Date(startDateStr + "T00:00:00");
    if (isNaN(startDateObj.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (startDateObj >= today) return startDateObj;
    let nextPayment = new Date(startDateObj);
    if (billingCycle === 'monthly') while (nextPayment < today) nextPayment.setMonth(nextPayment.getMonth() + 1);
    else if (billingCycle === 'annual') while (nextPayment < today) nextPayment.setFullYear(nextPayment.getFullYear() + 1);
    return nextPayment;
};

// Numeric Input Component for currency
const NumericInput = ({ value, onChange, placeholder, className, disabled }) => {
    const { colors, theme } = useTheme(); const { currencyConfig } = useSettings(); 
    const [displayValue, setDisplayValue] = useState('');
    useEffect(() => {
        if (typeof value === 'number' && !isNaN(value)) setDisplayValue(value.toLocaleString('es-CO', { maximumFractionDigits: 0 }));
        else if (value === '' || value === null || value === undefined) setDisplayValue('');
    }, [value]);
    const handleChange = (e) => {
        let inputVal = e.target.value; const numericString = inputVal.replace(/\D/g, '');
        const number = numericString ? parseInt(numericString, 10) : null;
        if (numericString === '') { setDisplayValue(''); onChange(null); } 
        else if (number !== null && !isNaN(number)) { setDisplayValue(number.toLocaleString('es-CO', { maximumFractionDigits: 0 })); onChange(number); }
    };
    return (
        <div className="relative">
             <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.textSecondary} text-base`}>{currencyConfig.symbol}</span>
            <input type="text" inputMode="numeric" value={displayValue} onChange={handleChange} placeholder={placeholder || "0"}
                className={className || `input-style w-full rounded-xl py-3 px-4 pl-8 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme === 'light' ? 400 : 500} focus:border-${colors.primaryAccent}-${theme === 'light' ? 400 : 500} transition-shadow`}
                disabled={disabled} />
        </div>
    );
};

// Generic Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null; const { theme, colors } = useTheme();
    const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center p-4 z-[100]"> 
            <div className={`${colors.card} p-6 rounded-xl shadow-2xl w-full ${sizeClasses[size]} transform transition-all duration-300 ease-out ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
                <div className="flex justify-between items-center mb-6"> 
                    <h2 className={`text-2xl font-semibold ${colors.textPrimary}`}>{title}</h2> 
                    <button onClick={onClose} className={`${colors.textSecondary} hover:text-${colors.primaryAccent}-${theme === 'light' ? 500 : 400} transition-colors`}><XCircle size={28}/></button> 
                </div>
                {children}
            </div>
        </div>
    );
};

// Confirmation Modal
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null; const { colors, theme } = useTheme();
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "Confirmar Acción"} size="sm">
            <p className={`${colors.textSecondary} mb-6 text-base`}>{message || "¿Estás seguro?"}</p> 
            <div className="flex justify-end space-x-4"> 
                <button onClick={onClose} className={`btn-secondary px-5 py-2.5 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme === 'light' ? 300: 600}`}>Cancelar</button>
                <button onClick={onConfirm} className={`btn-danger bg-${colors.secondaryAccent}-${theme === 'light' ? 500 : 600} hover:bg-${colors.secondaryAccent}-${theme === 'light' ? 600 : 700} text-white px-5 py-2.5`}>Confirmar</button>
            </div>
        </Modal>
    );
};

// Welcome Screen Component
const WelcomeScreen = ({ onContinue }) => {
    const { colors, theme } = useTheme();
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (name.trim() === '') {
            setError('Por favor, ingresa tu nombre.');
            return;
        }
        setError('');
        onContinue(name.trim());
    };

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${colors.background} ${colors.textPrimary} transition-all duration-300`}>
            <div className={`${colors.card} p-8 md:p-12 rounded-2xl shadow-2xl w-full max-w-md text-center transform transition-all duration-500 ease-out hover:scale-[1.02]`}>
                <PiggyBank size={80} className={`mx-auto mb-6 text-${colors.primaryAccent}-${theme === 'light' ? 500 : 400}`} />
                <h1 className={`text-4xl font-bold mb-3 text-${colors.primaryAccent}-${theme === 'light' ? 600 : 300}`}>FinanzasPro</h1>
                <p className={`${colors.textSecondary} text-lg mb-8`}>
                    Tu asistente personal para gestionar y controlar tus finanzas de manera intuitiva.
                </p>
                <div className="space-y-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ingresa tu nombre"
                        className={`input-style w-full rounded-xl py-3.5 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border-2 ${error ? 'border-red-500' : colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme === 'light' ? 400 : 500} focus:border-${colors.primaryAccent}-${theme === 'light' ? 400 : 500} transition-all`}
                    />
                    {error && <p className="text-red-500 text-sm -mt-2">{error}</p>}
                    <button
                        onClick={handleSubmit}
                        className={`w-full btn-primary bg-${colors.primaryAccent}-${theme === 'light' ? 500 : 400} hover:bg-${colors.primaryAccent}-${theme === 'light' ? 600 : 500} text-white text-lg py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center`}
                    >
                        Continuar <ArrowRightCircle size={22} className="ml-2.5" />
                    </button>
                </div>
            </div>
             <p className={`mt-8 text-sm ${colors.textSecondary}`}>© {new Date().getFullYear()} FinanzasPro. Todos los derechos reservados.</p>
        </div>
    );
};


// Main Application Component
function App() {
    const [userId, setUserId] = useState(null); const [isAuthReady, setIsAuthReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true); const [currentPage, setCurrentPage] = useState('dashboard');
    const [transactions, setTransactions] = useState([]); const [subscriptions, setSubscriptions] = useState([]);
    const [loans, setLoans] = useState([]); const [goals, setGoals] = useState([]); const [budgets, setBudgets] = useState([]);
    
    const [showWelcomeScreen, setShowWelcomeScreen] = useState(() => !localStorage.getItem('userNameFinPro'));
    const [userName, setUserName] = useState(() => localStorage.getItem('userNameFinPro') || '');

    const [isModalOpen, setIsModalOpen] = useState(false); const [modalType, setModalType] = useState(''); 
    const [editingItem, setEditingItem] = useState(null); const [itemToDelete, setItemToDelete] = useState(null); 
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const { theme, toggleTheme, colors } = useTheme();

    const getCollectionPath = useCallback(cn => userId ? `artifacts/${appId}/users/${userId}/${cn}` : null, [userId]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (cu) => {
            if (cu) setUserId(cu.uid);
            else try { __initial_auth_token ? await signInWithCustomToken(auth, __initial_auth_token) : await signInAnonymously(auth); }
                 catch (e) { console.error("Sign-in error:", e); setUserId(null); }
            setIsAuthReady(true); setIsLoading(false); 
        }); return unsub;
    }, []);
    
    useEffect(() => {
        if (!isAuthReady || !userId || showWelcomeScreen) { 
            if (!showWelcomeScreen) { 
                 setTransactions([]); setSubscriptions([]); setLoans([]); setGoals([]); setBudgets([]);
            }
            return; 
        }
        setIsLoading(true); 
        const cfgs = [
            {n:'transactions',s:setTransactions}, {n:'subscriptions',s:setSubscriptions},
            {n:'loans',s:setLoans}, {n:'goals',s:setGoals}, {n:'budgets',s:setBudgets}
        ];
        const unsubs = cfgs.map(c => {
            const cp = getCollectionPath(c.n); if (!cp) return ()=>{};
            return onSnapshot(query(collection(db, cp)), ss => c.s(ss.docs.map(d=>({id:d.id,...d.data()}))), e=>console.error(`Error fetching ${c.n}:`, e));
        });
        const t = setTimeout(()=>setIsLoading(false), 500); 
        return ()=>{clearTimeout(t); unsubs.forEach(u=>u());};
    }, [isAuthReady, userId, getCollectionPath, showWelcomeScreen]);

    const handleWelcomeContinue = (name) => {
        localStorage.setItem('userNameFinPro', name);
        localStorage.setItem('hasSeenWelcomeFinPro', 'true');
        setUserName(name);
        setShowWelcomeScreen(false);
    };

    const addFSItem = async (cn, item) => { if(!userId)return; const cp=getCollectionPath(cn); if(!cp)return; try{await addDoc(collection(db,cp),{...item,userId,createdAt:Timestamp.now()});}catch(e){console.error(e);} };
    const updateFSItem = async (cn,id,item)=>{if(!userId||!id||typeof id!=='string'||id.trim()===''||id.includes('/')){console.error("Update invalid:",{cn,id});return;}const cp=getCollectionPath(cn);if(!cp||typeof cp!=='string'||cp.trim()===''){console.error("Update invalid path:",{cp});return;}try{await updateDoc(doc(db,cp,id),item);}catch(e){console.error("Update error:",e,{cp,id});}};
    const requestDeleteItem=(cn,id)=>{if(!id||typeof id!=='string'||id.trim()===''){console.error("Delete invalid ID:",{cn,id});return;}setItemToDelete({collectionName:cn,id});setIsConfirmationModalOpen(true);};
    const confirmDeleteItem=async()=>{if(!itemToDelete||!userId){console.error("Delete invalid state.");return;}const{collectionName,id}=itemToDelete;if(!id||typeof id!=='string'||id.trim()===''||id.includes('/')){console.error("Delete invalid ID in confirm:",{collectionName,id});setIsConfirmationModalOpen(false);setItemToDelete(null);return;}const cp=getCollectionPath(collectionName);if(!cp||typeof cp!=='string'||cp.trim()===''){console.error("Delete invalid path in confirm:",{cp});setIsConfirmationModalOpen(false);setItemToDelete(null);return;}try{await deleteDoc(doc(db,cp,id));}catch(e){console.error("Delete error:",e,{cp,id});}finally{setIsConfirmationModalOpen(false);setItemToDelete(null);}};
    
    const openModal = (type, item=null) => { setModalType(type); setEditingItem(item); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setModalType(''); setEditingItem(null); };

    const navItems = [
        {id:'dashboard',l:'Dashboard',i:Home},{id:'transactions',l:'Transacciones',i:Wallet}, 
        {id:'subscriptions',l:'Suscripciones',i:Repeat},{id:'loans',l:'Préstamos',i:Landmark},
        {id:'goals',l:'Metas',i:Target}, {id:'budgets',l:'Presupuestos',i:Archive},
        {id:'settings',l:'Ajustes',i:Settings},
    ];

    const renderPage = () => {
        if (isLoading && !isAuthReady) return <div className={`flex-1 flex items-center justify-center ${colors.textPrimary}`}>Cargando plataforma...</div>;
        if (isLoading && isAuthReady && userId && !showWelcomeScreen) return <div className={`flex-1 flex items-center justify-center ${colors.textPrimary}`}>Cargando datos...</div>;
        if (showWelcomeScreen) return null; 

        switch(currentPage){
            case 'dashboard': return <Dashboard {...{transactions,subscriptions,loans,goals,budgets,openModal}}/>;
            case 'transactions': return <TransactionManager {...{transactions,openModal,deleteTransaction:requestDeleteItem}}/>;
            case 'subscriptions': return <SubscriptionManager {...{subscriptions,openModal,deleteSubscription:requestDeleteItem}}/>;
            case 'loans': return <LoanManager {...{loans,openModal,deleteLoan:requestDeleteItem, addFSItem, updateFSItem}}/>;
            case 'goals': return <SavingsGoalManager {...{goals,openModal,deleteGoal:requestDeleteItem, addFSItem, updateFSItem}}/>;
            case 'budgets': return <BudgetManager {...{budgets, transactions, openModal, deleteBudget:requestDeleteItem, addFSItem, updateFSItem}}/>;
            case 'settings': return <SettingsPage />; 
            default: return <Dashboard {...{transactions,subscriptions,loans,goals,budgets,openModal}}/>;
        }
    };

    if (!isAuthReady && !showWelcomeScreen) return <div className={`flex items-center justify-center min-h-screen ${colors.background}`}><div className={`text-xl font-semibold ${colors.textPrimary}`}>Cargando plataforma...</div></div>;
    if (!userId && isAuthReady && !showWelcomeScreen) return <div className={`flex items-center justify-center min-h-screen ${colors.background}`}><div className={`text-center p-6 ${colors.card} rounded-lg shadow-xl`}><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4"/><h2 className={`text-xl font-semibold ${colors.textPrimary} mb-2`}>Autenticación Fallida</h2><p className={`${colors.textSecondary}`}>No se pudo autenticar.</p></div></div>;

    if (showWelcomeScreen) {
        return <WelcomeScreen onContinue={handleWelcomeContinue} />;
    }

    return (
        <div className={`flex flex-col md:flex-row min-h-screen ${colors.background} ${colors.textPrimary} transition-colors duration-300 font-inter`}>
            <nav className={`${colors.card} w-64 p-4 md:p-6 shadow-xl md:min-h-screen hidden md:flex flex-col`}> 
                <div className="flex items-center justify-start mb-6"> 
                    <DollarSign className={`w-10 h-10 text-${colors.primaryAccent}-${theme==='light'?500:400} mr-3`}/>
                    <h1 className={`text-2xl font-bold ${colors.textPrimary}`}>FinanzasPro</h1>
                </div>
                {userName && (
                    <div className="mb-8 flex items-center p-3 rounded-xl bg-slate-100 dark:bg-slate-700/50">
                        <div className={`w-10 h-10 rounded-full ${colors.avatarBg} flex items-center justify-center text-xl font-semibold ${colors.avatarText} mr-3 flex-shrink-0`}>
                            {userName[0].toUpperCase()}
                        </div>
                        <div>
                            <p className={`text-sm ${colors.textSecondary}`}>¡Hola,</p>
                            <p className={`font-semibold ${colors.textPrimary} -mt-0.5 truncate`}>{userName}!</p>
                        </div>
                    </div>
                )}
                <ul className="space-y-3">{navItems.map(it=>(<li key={it.id}><button onClick={()=>setCurrentPage(it.id)} className={`w-full flex items-center p-3.5 rounded-xl transition-all duration-300 ease-in-out transform hover:scale-[1.03] hover:shadow-lg ${currentPage===it.id?`bg-${colors.primaryAccent}-${theme==='light'?500:400} text-white shadow-xl`:`${colors.hoverBg} text-${colors.textSecondary} hover:text-${colors.textPrimary}`}`}><it.i size={22} className="mr-4"/>{it.l}</button></li>))}</ul> 
                <div className="mt-auto pt-6"><p className="text-xs text-slate-400 dark:text-slate-500 mt-4 truncate" title={userId||"No ID"}>ID Usuario: {userId?userId.substring(0,12)+'...':'N/A'}</p></div>
            </nav>
            <div className="flex-1 flex flex-col">
                <header className={`md:hidden ${colors.card} shadow-lg p-4 flex justify-between items-center sticky top-0 z-50`}> 
                    <div className="flex items-center">
                        <DollarSign className={`w-8 h-8 text-${colors.primaryAccent}-${theme==='light'?500:400} mr-2`}/>
                         <h1 className={`text-xl font-bold ${colors.textPrimary}`}>FinanzasPro</h1>
                    </div>
                    <div className="flex items-center space-x-3">
                        {userName && (
                            <div className={`w-8 h-8 rounded-full ${colors.avatarBg} flex items-center justify-center text-sm font-semibold ${colors.avatarText} flex-shrink-0`}>
                                {userName[0].toUpperCase()}
                            </div>
                        )}
                        <button onClick={toggleTheme} className={`p-2 rounded-full ${colors.hoverBg} transition-colors`}><span className="sr-only">Cambiar tema</span>{theme==='light'?<Moon size={24} className={`${colors.textSecondary}`}/>:<Sun size={24} className={`${colors.textSecondary}`}/>}</button> 
                    </div>
                </header>
                <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 md:pb-8"> 
                    {renderPage()}
                </main>
            </div>
            <nav className={`md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-[90%]
                            ${colors.card} shadow-2xl rounded-full flex justify-center items-center 
                            p-2 space-x-1 sm:space-x-2 z-[60] transition-all duration-300 ease-in-out`}>
                {navItems.map(item => ( 
                    <button
                        key={item.id}
                        onClick={() => setCurrentPage(item.id)}
                        className={`p-3 rounded-full transition-all duration-300 ease-in-out transform 
                                    ${currentPage === item.id 
                                        ? `bg-${colors.primaryAccent}-${theme === 'light' ? 100 : 700} text-${colors.primaryAccent}-${theme === 'light' ? 600 : 300} scale-110 shadow-md` 
                                        : `${colors.textSecondary} hover:text-${colors.primaryAccent}-${theme === 'light' ? 500 : 300} hover:scale-105`}`}
                        title={item.label}
                        aria-label={item.label}
                    >
                        <item.i size={24} strokeWidth={currentPage === item.id ? 2.5 : 2} />
                    </button>
                ))}
            </nav>

            {isModalOpen&&modalType.includes('Transaction')&&<TransactionFormModal {...{isOpen:isModalOpen,onClose:closeModal,addTransaction:addFSItem,updateTransaction:updateFSItem,editingTransaction:editingItem}}/>}
            {isModalOpen&&modalType.includes('Subscription')&&<SubscriptionFormModal {...{isOpen:isModalOpen,onClose:closeModal,addSubscription:addFSItem,updateSubscription:updateFSItem,editingSubscription:editingItem}}/>}
            {isModalOpen&&modalType.includes('Loan')&&<LoanFormModal {...{isOpen:isModalOpen,onClose:closeModal,addLoan:addFSItem,updateLoan:updateFSItem,editingLoan:editingItem,initialLoanTypeFromModal:modalType==='addLoan'&&editingItem?.typeOverride?editingItem.typeOverride:(editingItem?.type)}}/>}
            {isModalOpen&&modalType === 'addGoal'&&<SavingsGoalFormModal {...{isOpen:isModalOpen,onClose:closeModal,addGoal:addFSItem,editingGoal:null}}/>}
            {isModalOpen&&modalType === 'editGoal'&&<SavingsGoalFormModal {...{isOpen:isModalOpen,onClose:closeModal,updateGoal:updateFSItem,editingGoal:editingItem}}/>}
            {isModalOpen&&modalType === 'addFundsToGoal'&&<AddFundsToGoalModal {...{isOpen:isModalOpen,onClose:closeModal,goal:editingItem,updateGoal:updateFSItem,addTransaction:addFSItem}}/>}
            {isModalOpen&&modalType === 'recordLoanPayment'&&<RecordLoanPaymentModal {...{isOpen:isModalOpen,onClose:closeModal,loan:editingItem,updateLoan:updateFSItem,addTransaction:addFSItem}}/>}
            {isModalOpen&&modalType === 'addBudget'&&<BudgetFormModal {...{isOpen:isModalOpen,onClose:closeModal,addBudget:addFSItem,editingBudget:null, transactions}}/>}
            {isModalOpen&&modalType === 'editBudget'&&<BudgetFormModal {...{isOpen:isModalOpen,onClose:closeModal,updateBudget:updateFSItem,editingBudget:editingItem, transactions}}/>}
            <ConfirmationModal {...{isOpen:isConfirmationModalOpen,onClose:()=>setIsConfirmationModalOpen(false),onConfirm:confirmDeleteItem,title:"Confirmar Eliminación",message:"¿Seguro que deseas eliminar? No se puede deshacer."}}/>
        </div>
    );
}

// --- Settings Page ---
const SettingsPage = () => { 
    const { theme, toggleTheme, colors } = useTheme();
    const { currency, setCurrency } = useSettings(); 

    return (
        <div className="space-y-8"> 
            <h2 className={`text-4xl font-bold ${colors.textPrimary} mb-8`}>Ajustes</h2> 
            <div className={`${colors.card} p-8 rounded-2xl shadow-xl`}> 
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <h3 className={`text-xl font-semibold ${colors.textPrimary}`}>Tema Visual</h3> 
                    <button onClick={toggleTheme} className={`p-3.5 rounded-xl ${colors.hoverBg} transition-all duration-300 flex items-center text-base ${colors.textSecondary} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} hover:text-${colors.textPrimary} hover:shadow-md`}><span className="mr-3">{theme==='light'?<Moon size={22}/>:<Sun size={22}/>}</span>Cambiar a Tema {theme==='light'?'Oscuro':'Claro'}</button> 
                </div><p className={`mt-3 text-base ${colors.textSecondary}`}>Personaliza la apariencia de la aplicación para una mejor experiencia visual.</p> 
            </div>

            <div className={`${colors.card} p-8 rounded-2xl shadow-xl`}>
                <h3 className={`text-xl font-semibold ${colors.textPrimary} mb-4`}>Configuración de Moneda</h3>
                <div className="max-w-xs">
                    <label htmlFor="currency-select" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Selecciona tu moneda</label>
                    <div className="relative">
                        <Coins size={20} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${colors.textSecondary}`}/>
                        <select 
                            id="currency-select"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className={`input-style w-full rounded-xl py-3 px-4 pl-12 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow appearance-none`}
                        >
                            {Object.entries(SUPPORTED_CURRENCIES).map(([code, config]) => (
                                <option key={code} value={code}>{config.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={20} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${colors.textSecondary} pointer-events-none`}/>
                    </div>
                </div>
                <p className={`mt-3 text-base ${colors.textSecondary}`}>Los montos se mostrarán en la moneda seleccionada.</p>
            </div>
            <div className={`${colors.card} p-8 rounded-2xl shadow-xl`}><h3 className={`text-xl font-semibold ${colors.textPrimary}`}>Más Opciones</h3><p className={`mt-3 text-base ${colors.textSecondary}`}>Configuración de moneda ¡ya disponible! Próximamente: notificaciones, exportación de datos y más.</p></div>
        </div>
    );
};

// --- Dashboard Component ---
const Dashboard = ({ transactions, subscriptions, loans, goals, budgets, openModal }) => { 
    const { theme, colors } = useTheme();
    const { currencyConfig } = useSettings();

    const summary = useMemo(() => { 
        const now=new Date(),cm=now.getMonth(),cy=now.getFullYear();
        const mi=transactions.filter(t=>t.type==='income'&&t.date&&new Date(formatDate(t.date)+"T00:00:00").getMonth()===cm&&new Date(formatDate(t.date)+"T00:00:00").getFullYear()===cy).reduce((s,t)=>s+parseFloat(t.amount||0),0);
        const me=transactions.filter(t=>t.type==='expense'&&t.date&&new Date(formatDate(t.date)+"T00:00:00").getMonth()===cm&&new Date(formatDate(t.date)+"T00:00:00").getFullYear()===cy).reduce((s,t)=>s+parseFloat(t.amount||0),0);
        const ti=transactions.filter(t=>t.type==='income').reduce((s,t)=>s+parseFloat(t.amount||0),0);
        const te=transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+parseFloat(t.amount||0),0);
        return{monthlyIncome:mi,monthlyExpenses:me,balance:ti-te};
    },[transactions]);
    const expenseCategories=useMemo(()=>Object.entries(transactions.filter(t=>t.type==='expense'&&t.category).reduce((cats,t)=>{cats[t.category]=(cats[t.category]||0)+parseFloat(t.amount||0);return cats;},{})).map(([name,value])=>({name,value})),[transactions]);
    const incomeExpenseTrend=useMemo(()=>{const d={};transactions.forEach(t=>{if(!t.date)return;const fd=formatDate(t.date);if(!fd)return;const dt=new Date(fd+"T00:00:00"),my=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;d[my]=d[my]||{income:0,expense:0};if(t.type==='income')d[my].income+=parseFloat(t.amount||0);if(t.type==='expense')d[my].expense+=parseFloat(t.amount||0);});return Object.entries(d).map(([name,values])=>({name,...values})).sort((a,b)=>a.name.localeCompare(b.name));},[transactions]);
    const upcomingPayments=useMemo(()=>{const today=new Date();today.setHours(0,0,0,0);const nextWeek=new Date(today);nextWeek.setDate(today.getDate()+7);const us=subscriptions.map(s=>{const npd=calculateNextPaymentDate(s.startDate,s.billingCycle);return{...s,nextPaymentDate:npd,type:'Suscripción'};}).filter(s=>s.nextPaymentDate&&s.nextPaymentDate>=today&&s.nextPaymentDate<=nextWeek);const udl=loans.filter(l=>l.type==='debtor').map(l=>{if(!l.startDate)return null;const lsd=new Date(formatDate(l.startDate)+"T00:00:00");if(isNaN(lsd.getTime()))return null;let ndd=new Date(today.getFullYear(),today.getMonth(),lsd.getDate());while(ndd<today)ndd.setMonth(ndd.getMonth()+1);const tim=l.termUnit==='years'?(l.term*12):l.term;const ed=new Date(lsd);ed.setMonth(lsd.getMonth()+tim);if(ndd>ed)return null;return{...l,nextPaymentDate:ndd,type:'Préstamo (Deuda)',name:l.lenderName,amount:l.monthlyPayment};}).filter(l=>l&&l.nextPaymentDate&&l.nextPaymentDate>=today&&l.nextPaymentDate<=nextWeek);return[...us,...udl].sort((a,b)=>a.nextPaymentDate-b.nextPaymentDate).slice(0,5);},[subscriptions,loans]);
    const CHART_COLORS={pie:[colors.primaryAccent,colors.secondaryAccent,'green','amber','indigo','purple'],lineIncome:theme==='light'?THEME_COLORS.light.primaryAccent:THEME_COLORS.dark.primaryAccent,lineExpense:theme==='light'?THEME_COLORS.light.secondaryAccent:THEME_COLORS.dark.secondaryAccent};
    const getTailwindColor=(cn)=>{const cm={cyan:{light:'#06b6d4',dark:'#22d3ee'},pink:{light:'#ec4899',dark:'#f472b6'},green:{light:'#10b981',dark:'#34d399'},amber:{light:'#f59e0b',dark:'#fbbf24'},indigo:{light:'#6366f1',dark:'#818cf8'},purple:{light:'#8b5cf6',dark:'#a78bfa'}};return cm[cn]?.[theme]||(theme==='light'?'#06b6d4':'#22d3ee');};
    
    const BentoBox=({children,className="",hoverEffect=true, hoverBgClass=""})=>(
        <div className={`${colors.card} p-4 md:p-6 rounded-2xl shadow-xl ${hoverEffect ? `transition-all duration-300 ease-in-out hover:shadow-2xl hover:scale-[1.02] ${hoverBgClass}` : ''} ${className}`}>
            {children}
        </div>
    );
    
    const StatCard=({title,value,icon:Icon,colorName, hoverColorName=""})=>{
        const iconColorClass = `text-${colorName}-${theme === 'light' ? 500 : 400}`;
        let hoverBgClass = "";
        if (hoverColorName) {
            hoverBgClass = theme === 'light' 
                ? `hover:bg-${hoverColorName}-50` 
                : `hover:bg-${hoverColorName}-900 hover:bg-opacity-50`; 
        }

        return (
            <BentoBox className="flex flex-col justify-between" hoverBgClass={hoverBgClass}>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-base font-medium ${colors.textSecondary}`}>{title}</h3> 
                        <Icon className={`w-7 h-7 ${iconColorClass}`}/> 
                    </div>
                    <p className={`text-3xl md:text-4xl font-bold ${colors.textPrimary}`}>{formatCurrencyDisplay(value, currencyConfig)}</p> 
                </div>
            </BentoBox>
        );
    };

    return(
        <div className="space-y-8"> 
            <h2 className={`text-4xl font-bold ${colors.textPrimary} mb-8`}>Dashboard Analítico</h2> 
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"> 
                <StatCard title="Saldo Actual" value={summary.balance} icon={DollarSign} colorName="green" hoverColorName="green"/>
                <StatCard title="Ingresos del Mes" value={summary.monthlyIncome} icon={TrendingUp} colorName={colors.primaryAccent} hoverColorName="emerald"/> 
                <StatCard title="Egresos del Mes" value={summary.monthlyExpenses} icon={TrendingDown} colorName={colors.secondaryAccent} hoverColorName="red"/>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8"> 
                <BentoBox className="lg:col-span-3 h-[400px]"><h3 className={`text-xl font-semibold mb-4 ${colors.textSecondary}`}>Distribución de Egresos</h3>{expenseCategories.length>0?(<ResponsiveContainer width="100%" height="85%"><PieChart><Pie data={expenseCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} labelLine={false} label={({cx,cy,midAngle,innerRadius,outerRadius,percent})=>{const RADIAN=Math.PI/180,radius=innerRadius+(outerRadius-innerRadius)*0.5,x=cx+radius*Math.cos(-midAngle*RADIAN),y=cy+radius*Math.sin(-midAngle*RADIAN);return(percent*100)>5?(<text x={x} y={y} fill="white" textAnchor={x>cx?'start':'end'} dominantBaseline="central" fontSize="14px">{`${(percent*100).toFixed(0)}%`}</text>):null;}}>{expenseCategories.map((_,idx)=>(<Cell key={`cell-${idx}`} fill={getTailwindColor(CHART_COLORS.pie[idx%CHART_COLORS.pie.length])}/>))}</Pie><Tooltip formatter={v => formatCurrencyDisplay(v, currencyConfig)} /><Legend wrapperStyle={{fontSize: '14px'}}/></PieChart></ResponsiveContainer>):(<EmptyState icon={PieChartIcon} message="No hay datos de egresos."/>)}</BentoBox> 
                <BentoBox className="lg:col-span-2 h-[400px]"><h3 className={`text-xl font-semibold mb-4 ${colors.textSecondary}`}>Próximos Pagos (7 días)</h3>{upcomingPayments.length>0?(<ul className="space-y-4 overflow-y-auto h-[calc(100%-3.5rem)] pr-2 custom-scrollbar">{upcomingPayments.map((it,idx)=>(<li key={idx} className={`flex justify-between items-center p-4 ${theme==='light'?'bg-slate-100':'bg-slate-700/60'} rounded-xl hover:shadow-lg transition-shadow`}><div><p className={`font-semibold text-base ${colors.textPrimary}`}>{it.serviceName||it.name}</p><p className={`text-sm ${colors.textSecondary}`}>{it.type} - {formatDate(it.nextPaymentDate, 'descriptive')}</p></div><p className={`font-bold text-base text-${colors.primaryAccent}-${theme==='light'?600:400}`}>{formatCurrencyDisplay(it.price||it.amount||0, currencyConfig)}</p></li>))}</ul>):(<EmptyState icon={CalendarDays} message="Sin pagos próximos."/>)}</BentoBox> 
            </div>
            <BentoBox className="h-[400px]"><h3 className={`text-xl font-semibold mb-4 ${colors.textSecondary}`}>Evolución Ingresos vs. Egresos</h3>{incomeExpenseTrend.length>1?(<ResponsiveContainer width="100%" height="85%"><LineChart data={incomeExpenseTrend}><CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid}/><XAxis dataKey="name" stroke={colors.chartText} tick={{fontSize: 12}}/><YAxis stroke={colors.chartText} tickFormatter={v=>`${currencyConfig.symbol}${v/1000}k`} tick={{fontSize: 12}}/><Tooltip formatter={(value, name) => `${name === 'income' ? 'Ingresos' : 'Egresos'}: ${formatCurrencyDisplay(value, currencyConfig)}`} contentStyle={{backgroundColor:theme==='light'?'white':THEME_COLORS.dark.card,border:`1px solid ${colors.border}`, borderRadius: '0.5rem'}} labelStyle={{color:colors.textPrimary, fontWeight: 'bold'}} itemStyle={{fontSize: '14px'}}/><Legend wrapperStyle={{fontSize: '14px'}}/><Line type="monotone" dataKey="income" name="Ingresos" stroke={getTailwindColor(CHART_COLORS.lineIncome)} strokeWidth={3} dot={{r:5,fill:getTailwindColor(CHART_COLORS.lineIncome)}} activeDot={{r:7}}/><Line type="monotone" dataKey="expense" name="Egresos" stroke={getTailwindColor(CHART_COLORS.lineExpense)} strokeWidth={3} dot={{r:5,fill:getTailwindColor(CHART_COLORS.lineExpense)}} activeDot={{r:7}}/></LineChart></ResponsiveContainer>):(<EmptyState icon={BarChart2} message="Datos insuficientes."/>)}</BentoBox> 
            <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40"><button onClick={()=>openModal('addTransaction')} className={`bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} text-white font-semibold p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-${colors.primaryAccent}-${theme==='light'?300:600} focus:ring-opacity-50 flex items-center`} aria-label="Agregar Transacción"><PlusCircle size={28}/><span className="ml-2.5 hidden sm:inline text-base">Nueva Transacción</span></button></div> 
        </div>
    );
};

const EmptyState = ({ icon:Icon, message, actionButton }) => {
    const { colors, theme } = useTheme();
    let styledActionButton = actionButton;
    if (actionButton && React.isValidElement(actionButton) && actionButton.type === 'button' && !actionButton.props.className?.includes('rounded-lg')) {
        styledActionButton = React.cloneElement(actionButton, { 
            className: `${actionButton.props.className || ''} rounded-lg` 
        });
    }

    return (<div className={`flex flex-col items-center justify-center h-full text-center p-6 ${colors.textSecondary}`}>{Icon && <Icon size={56} className={`mb-5 opacity-50 text-${colors.primaryAccent}-${theme==='light'?400:500}`}/>}<p className="mb-5 text-lg">{message}</p>{styledActionButton}</div>); 
};

// --- Transaction Management ---
const TransactionManager = ({ transactions, openModal, deleteTransaction }) => {
    const { colors, theme } = useTheme();
    const { currencyConfig } = useSettings();
    const [filterType, setFilterType] = useState(''); const [filterCategory, setFilterCategory] = useState('');
    const [filterStartDate, setFilterStartDate] = useState(''); const [filterEndDate, setFilterEndDate] = useState('');
    const [searchTerm, setSearchTerm] = useState(''); const [sortConfig, setSortConfig] = useState({key:'date',direction:'descending'});
    const categories=useMemo(()=>Array.from(new Set(transactions.map(t=>t.category).filter(Boolean))).sort(),[transactions]);
    const filteredAndSortedTransactions=useMemo(()=>{let items=[...transactions];if(filterType)items=items.filter(t=>t.type===filterType);if(filterCategory)items=items.filter(t=>t.category===filterCategory);if(filterStartDate){const s=new Date(formatDate(filterStartDate)+"T00:00:00");items=items.filter(t=>t.date&&new Date(formatDate(t.date)+"T00:00:00")>=s);}if(filterEndDate){const e=new Date(formatDate(filterEndDate)+"T23:59:59");items=items.filter(t=>t.date&&new Date(formatDate(t.date)+"T00:00:00")<=e);}if(searchTerm)items=items.filter(t=>(t.name&&t.name.toLowerCase().includes(searchTerm.toLowerCase()))||(t.category&&t.category.toLowerCase().includes(searchTerm.toLowerCase())));items.sort((a,b)=>{let vA=a[sortConfig.key],vB=b[sortConfig.key];if(sortConfig.key==='amount'){vA=parseFloat(vA||0);vB=parseFloat(vB||0);}else if(sortConfig.key==='date'&&a.date&&b.date){vA=new Date(formatDate(a.date)+"T00:00:00");vB=new Date(formatDate(b.date)+"T00:00:00");}else if(sortConfig.key==='date'){vA=a.date?new Date(formatDate(a.date)+"T00:00:00"):new Date(0);vB=b.date?new Date(formatDate(b.date)+"T00:00:00"):new Date(0);}if(vA<vB)return sortConfig.direction==='ascending'?-1:1;if(vA>vB)return sortConfig.direction==='ascending'?1:-1;return 0;});return items;},[transactions,filterType,filterCategory,filterStartDate,filterEndDate,searchTerm,sortConfig]);
    const requestSort=(key)=>{let dir='ascending';if(sortConfig.key===key&&sortConfig.direction==='ascending')dir='descending';setSortConfig({key,direction:dir});};
    const getSortIndicator=(key)=>(sortConfig.key!==key?null:sortConfig.direction==='ascending'?<ChevronUp size={18} className="inline ml-1.5"/>:<ChevronDown size={18} className="inline ml-1.5"/>); 
    const TableHeaderButton=({label,sortKey})=>(<button onClick={()=>requestSort(sortKey)} className={`flex items-center text-base font-semibold ${colors.textSecondary} hover:text-${colors.primaryAccent}-${theme==='light'?500:400} transition-colors`}>{label}{getSortIndicator(sortKey)}</button>); 
    const FilterInputWrapper=({children,icon:Icon})=>(<div className="relative flex items-center">{Icon&&<Icon size={20} className={`absolute left-3.5 ${colors.textSecondary} pointer-events-none`}/>}{children}</div>); 
    return(
        <div className="space-y-8"> 
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4"><h2 className={`text-4xl font-bold ${colors.textPrimary}`}>Historial de Transacciones</h2></div> 
            <div className={`${colors.card} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 p-6 rounded-2xl shadow-xl`}> 
                <FilterInputWrapper icon={Search}><input type="text" placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className={`input-style w-full pl-12 py-3 rounded-xl ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow text-base`}/></FilterInputWrapper> 
                <FilterInputWrapper icon={FilterIcon}><select value={filterType} onChange={e=>setFilterType(e.target.value)} className={`input-style w-full pl-12 py-3 rounded-xl ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow text-base`}><option value="">Todo Tipo</option><option value="income">Ingreso</option><option value="expense">Egreso</option></select></FilterInputWrapper>
                <FilterInputWrapper icon={Tag}><select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} className={`input-style w-full pl-12 py-3 rounded-xl ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow text-base`}><option value="">Toda Categoría</option>{categories.map(cat=><option key={cat} value={cat}>{cat}</option>)}</select></FilterInputWrapper>
                <FilterInputWrapper icon={CalendarDays}><input type="date" value={filterStartDate} onChange={e=>setFilterStartDate(e.target.value)} className={`input-style w-full pl-12 py-3 rounded-xl ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow text-base`} placeholder="Fecha Inicio"/></FilterInputWrapper>
                <FilterInputWrapper icon={CalendarDays}><input type="date" value={filterEndDate} onChange={e=>setFilterEndDate(e.target.value)} className={`input-style w-full pl-12 py-3 rounded-xl ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow text-base`} placeholder="Fecha Fin"/></FilterInputWrapper>
            </div>
            {filteredAndSortedTransactions.length===0?(<EmptyState icon={List} message="Aún no tienes transacciones."/>):(
            <div className={`${colors.card} shadow-xl rounded-2xl overflow-x-auto`}> 
                <table className="w-full min-w-max"><thead className={`${theme==='light'?'bg-slate-100':'bg-slate-700/50'}`}><tr><th className="p-5 text-left"><TableHeaderButton label="Fecha" sortKey="date"/></th><th className="p-5 text-left"><TableHeaderButton label="Descripción" sortKey="name"/></th><th className="p-5 text-left"><TableHeaderButton label="Tipo" sortKey="type"/></th><th className="p-5 text-left"><TableHeaderButton label="Categoría" sortKey="category"/></th><th className="p-5 text-right"><TableHeaderButton label="Monto" sortKey="amount"/></th><th className="p-5 text-center">Acciones</th></tr></thead> 
                <tbody>{filteredAndSortedTransactions.map(t=>(
                    <tr key={t.id} className={`border-b ${colors.border} ${colors.hoverBg} transition-colors`}>
                        <td className="p-5 whitespace-nowrap text-base">{formatDate(t.date, 'descriptive')}</td>
                        <td className="p-5 whitespace-nowrap text-base">{t.name}</td>
                        <td className="p-5 whitespace-nowrap text-base">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-green-100 dark:bg-green-800' : 'bg-red-100 dark:bg-red-800'}`}>
                                {t.type === 'income' ? <TrendingUp size={18} className="text-green-500 dark:text-green-400" /> : <TrendingDown size={18} className="text-red-500 dark:text-red-400" />}
                            </div>
                        </td>
                        <td className="p-5 whitespace-nowrap text-base">{t.category||'-'}</td>
                        <td className={`p-5 whitespace-nowrap text-right font-semibold text-base ${t.type==='income'?'text-green-600 dark:text-green-400':`text-${colors.secondaryAccent}-${theme==='light'?600:400}`}`}>{formatCurrencyDisplay(parseFloat(t.amount||0), currencyConfig)}</td>
                        <td className="p-5 text-center whitespace-nowrap"><button onClick={()=>openModal('editTransaction',t)} className={`text-${colors.primaryAccent}-${theme==='light'?500:400} hover:text-${colors.primaryAccent}-${theme==='light'?700:300} mr-2.5 p-1.5 transition-colors`} title="Editar"><Edit3 size={20}/></button><button onClick={()=>deleteTransaction('transactions',t.id)} className={`text-${colors.secondaryAccent}-${theme==='light'?500:400} hover:text-${colors.secondaryAccent}-${theme==='light'?700:300} p-1.5 transition-colors`} title="Eliminar"><Trash2 size={20}/></button></td>
                    </tr>
                ))} 
                {filteredAndSortedTransactions.length===0&&(searchTerm||filterType||filterCategory||filterStartDate||filterEndDate)&&(<tr><td colSpan="6" className="text-center p-10 text-lg text-gray-500 dark:text-gray-400">No se encontraron transacciones.</td></tr>)}</tbody></table> 
            </div>)}
            <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40"><button onClick={()=>openModal('addTransaction')} className={`bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} text-white font-semibold p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-${colors.primaryAccent}-${theme==='light'?300:600} focus:ring-opacity-50 flex items-center`} aria-label="Agregar Transacción"><PlusCircle size={28}/><span className="ml-2.5 hidden sm:inline text-base">Nueva Transacción</span></button></div> 
        </div>
    );
};

const TransactionFormModal = ({ isOpen, onClose, addTransaction, updateTransaction, editingTransaction }) => {
    const { colors, theme } = useTheme();
    const { customCategories } = useCustomCategories();
    const [type, setType] = useState('expense'); const [name, setName] = useState('');
    const [amount, setAmount] = useState(null); 
    const [date, setDate] = useState(formatDate(new Date())); const [category, setCategory] = useState('');
    const [errors, setErrors] = useState({});
    
    const defaultCommonCategories=['Comida','Transporte','Salud','Entretenimiento','Hogar','Educación','Ropa','Otros', 'Metas de Ahorro', 'Pago Préstamo'];
    const defaultIncomeCategories=['Salario','Bonificación','Inversiones','Regalo','Otros', 'Cobro Préstamo'];

    const combinedCategories = useMemo(() => {
        const base = type === 'income' ? defaultIncomeCategories : defaultCommonCategories;
        return Array.from(new Set([...base, ...customCategories])).sort();
    }, [type, customCategories]);


    useEffect(()=>{if(editingTransaction){setType(editingTransaction.type);setName(editingTransaction.name);setAmount(parseFloat(editingTransaction.amount||0));setDate(formatDate(editingTransaction.date));setCategory(editingTransaction.category||'');}else{setType('expense');setName('');setAmount(null);setDate(formatDate(new Date()));setCategory('');}setErrors({});},[editingTransaction,isOpen]);
    const validate=()=>{const e={};if(!name.trim())e.name="Nombre obligatorio.";if(amount===null||isNaN(amount)||amount<=0)e.amount="Cantidad positiva.";if(!date)e.date="Fecha obligatoria.";if(type==='expense'&&!category.trim())e.category="Categoría para egresos.";setErrors(e);return Object.keys(e).length===0;};
    const handleSubmit=async(ev)=>{ev.preventDefault();if(!validate())return;const d={type,name,amount:parseFloat(amount),date,category:type==='expense'?category:(category||null)};if(editingTransaction)await updateTransaction('transactions',editingTransaction.id,d);else await addTransaction('transactions',d);onClose();};
    
    return(
        <Modal isOpen={isOpen} onClose={onClose} title={editingTransaction?'Editar Transacción':'Agregar Transacción'}>
            <form onSubmit={handleSubmit} className="space-y-5"> 
                <div><label className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Tipo</label><select value={type} onChange={e=>{setType(e.target.value);setCategory('');}} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}><option value="expense">Egreso</option><option value="income">Ingreso</option></select></div> 
                <div><label htmlFor="name" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Nombre/Descripción</label><input type="text" id="name" value={name} onChange={e=>setName(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.name&&<p className="text-red-500 text-sm mt-1.5">{errors.name}</p>}</div>
                <div><label htmlFor="amount" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Cantidad</label><NumericInput value={amount} onChange={setAmount} placeholder="0"/>{errors.amount&&<p className="text-red-500 text-sm mt-1.5">{errors.amount}</p>}</div>
                <div><label htmlFor="date" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Fecha</label><input type="date" id="date" value={date} onChange={e=>setDate(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.date&&<p className="text-red-500 text-sm mt-1.5">{errors.date}</p>}</div>
                <div><label htmlFor="category" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Categoría {type==='income'&&'(Opcional)'}</label><input list="categories-datalist" type="text" id="category" value={category} onChange={e=>setCategory(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/><datalist id="categories-datalist">{combinedCategories.map(c=><option key={c} value={c}/>)}</datalist>{errors.category&&<p className="text-red-500 text-sm mt-1.5">{errors.category}</p>}</div>
                <div className="flex justify-end space-x-4 pt-3"><button type="button" onClick={onClose} className={`btn-secondary px-6 py-3 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} text-base`}>Cancelar</button><button type="submit" className={`btn-primary bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} px-6 py-3 text-base`}>{editingTransaction?'Actualizar':'Agregar'}</button></div> 
            </form>
        </Modal>
    );
};

// --- Subscription Management ---
const SubscriptionManager = ({ subscriptions, openModal, deleteSubscription }) => {
    const { colors, theme } = useTheme();
    const { currencyConfig } = useSettings();
    return(
        <div className="space-y-8"> 
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4"><h2 className={`text-4xl font-bold ${colors.textPrimary}`}>Gestión de Suscripciones</h2></div> 
            {subscriptions.length===0?(<EmptyState icon={Repeat} message="No tienes suscripciones." />):(
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{subscriptions.map(s=>{const np=calculateNextPaymentDate(s.startDate,s.billingCycle);return(<div key={s.id} className={`${colors.card} p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03]`}><div className="flex justify-between items-start mb-4"><h3 className={`text-2xl font-semibold ${colors.textPrimary}`}>{s.serviceName}</h3><span className={`text-sm bg-${colors.secondaryAccent}-100 dark:bg-${colors.secondaryAccent}-700 text-${colors.secondaryAccent}-700 dark:text-${colors.secondaryAccent}-200 px-3 py-1.5 rounded-full font-semibold`}>{s.category}</span></div><p className={`text-3xl font-bold text-${colors.primaryAccent}-${theme==='light'?600:400} mb-2`}>{formatCurrencyDisplay(parseFloat(s.price||0), currencyConfig)}<span className={`text-base font-normal ${colors.textSecondary}`}> / {s.billingCycle==='monthly'?'mes':'año'}</span></p><p className={`text-base ${colors.textSecondary}`}>Inició: {formatDate(s.startDate, 'descriptive')}</p>{np&&<p className={`text-base text-green-600 dark:text-green-400 font-semibold`}>Próximo pago: {formatDate(np, 'descriptive')}</p>}<div className={`mt-5 pt-4 border-t ${colors.border} flex justify-end space-x-3`}><button onClick={()=>openModal('editSubscription',s)} className={`p-2.5 text-${colors.primaryAccent}-${theme==='light'?500:400} hover:text-${colors.primaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Editar"><Edit3 size={20}/></button><button onClick={()=>deleteSubscription('subscriptions',s.id)} className={`p-2.5 text-${colors.secondaryAccent}-${theme==='light'?500:400} hover:text-${colors.secondaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Eliminar"><Trash2 size={20}/></button></div></div>);})}</div>)} 
            <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40"><button onClick={()=>openModal('addSubscription')} className={`bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} text-white font-semibold p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-${colors.primaryAccent}-${theme==='light'?300:600} focus:ring-opacity-50 flex items-center`} aria-label="Agregar Suscripción"><PlusCircle size={28}/><span className="ml-2.5 hidden sm:inline text-base">Nueva Suscripción</span></button></div>
        </div>
    );
};

const SubscriptionFormModal = ({ isOpen, onClose, addSubscription, updateSubscription, editingSubscription }) => {
    const { colors, theme } = useTheme();
    const [serviceName, setServiceName] = useState(''); const [category, setCategory] = useState('');
    const [price, setPrice] = useState(null); const [billingCycle, setBillingCycle] = useState('monthly');
    const [startDate, setStartDate] = useState(formatDate(new Date())); const [errors, setErrors] = useState({});
    const subCats=['Streaming','Software','Gimnasio','Noticias','Música','Gaming','Utilidades','Otro'];
    useEffect(()=>{if(editingSubscription){setServiceName(editingSubscription.serviceName);setCategory(editingSubscription.category);setPrice(parseFloat(editingSubscription.price||0));setBillingCycle(editingSubscription.billingCycle);setStartDate(formatDate(editingSubscription.startDate));}else{setServiceName('');setCategory('');setPrice(null);setBillingCycle('monthly');setStartDate(formatDate(new Date()));}setErrors({});},[editingSubscription,isOpen]);
    const validate=()=>{const e={};if(!serviceName.trim())e.serviceName="Nombre obligatorio.";if(!category.trim())e.category="Categoría obligatoria.";if(price===null||isNaN(price)||price<=0)e.price="Precio positivo.";if(!startDate)e.startDate="Fecha inicio obligatoria.";setErrors(e);return Object.keys(e).length===0;};
    const handleSubmit=async(ev)=>{ev.preventDefault();if(!validate())return;const d={serviceName,category,price:parseFloat(price),billingCycle,startDate};if(editingSubscription)await updateSubscription('subscriptions',editingSubscription.id,d);else await addSubscription('subscriptions',d);onClose();};
    return(
        <Modal isOpen={isOpen} onClose={onClose} title={editingSubscription?'Editar Suscripción':'Agregar Suscripción'}>
            <form onSubmit={handleSubmit} className="space-y-5"> 
                <div><label htmlFor="sub-serviceName" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Nombre del Servicio</label><input type="text" id="sub-serviceName" value={serviceName} onChange={e=>setServiceName(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.serviceName&&<p className="text-red-500 text-sm mt-1.5">{errors.serviceName}</p>}</div> 
                <div><label htmlFor="sub-category" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Categoría</label><input list="subscription-categories-datalist" type="text" id="sub-category" value={category} onChange={e=>setCategory(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/><datalist id="subscription-categories-datalist">{subCats.map(c=><option key={c} value={c}/>)}</datalist>{errors.category&&<p className="text-red-500 text-sm mt-1.5">{errors.category}</p>}</div>
                <div className="grid grid-cols-2 gap-5"> 
                    <div><label htmlFor="sub-price" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Precio</label><NumericInput value={price} onChange={setPrice} placeholder="0" />{errors.price&&<p className="text-red-500 text-sm mt-1.5">{errors.price}</p>}</div>
                    <div><label htmlFor="sub-billingCycle" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Ciclo Facturación</label><select id="sub-billingCycle" value={billingCycle} onChange={e=>setBillingCycle(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}><option value="monthly">Mensual</option><option value="annual">Anual</option></select></div>
                </div>
                <div><label htmlFor="sub-startDate" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Fecha Inicio/Renovación</label><input type="date" id="sub-startDate" value={startDate} onChange={e=>setStartDate(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.startDate&&<p className="text-red-500 text-sm mt-1.5">{errors.startDate}</p>}</div>
                <div className="flex justify-end space-x-4 pt-3"><button type="button" onClick={onClose} className={`btn-secondary px-6 py-3 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} text-base`}>Cancelar</button><button type="submit" className={`btn-primary bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} px-6 py-3 text-base`}>{editingSubscription?'Actualizar':'Agregar'}</button></div> 
            </form>
        </Modal>
    );
};

// --- Loan Management ---
const LoanManager = ({ loans, openModal, deleteLoan }) => {
    const { colors, theme } = useTheme();
    const { currencyConfig } = useSettings();
    const debtorLoans=loans.filter(l=>l.type==='debtor'); const creditorLoans=loans.filter(l=>l.type==='creditor');

    const calculateTotalPaid = (paymentsArray) => (paymentsArray || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const LoanCard=({loan})=>{
        const isDebtor=loan.type==='debtor';
        const principal=parseFloat(loan.totalLoanAmount||loan.amountLoaned||0);
        const payments = isDebtor ? loan.paymentsMade : loan.paymentsReceived;
        const totalPaidOrReceived = calculateTotalPaid(payments);
        const balance = Math.max(0, principal - totalPaidOrReceived);
        const progress = principal > 0 ? (totalPaidOrReceived / principal) * 100 : 0;
        const isFullyPaid = totalPaidOrReceived >= principal;

        let nextPaymentDisplayDate = 'N/A';
        if (loan.startDate && !isFullyPaid) {
            const startDate = new Date(formatDate(loan.startDate) + "T00:00:00");
            if (!isNaN(startDate.getTime())) {
                startDate.setMonth(startDate.getMonth() + (payments?.length || 0) + 1); 
                nextPaymentDisplayDate = formatDate(startDate, 'descriptive');
            }
        }
        
    return(<div className={`${colors.card} p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03]`}><div className="flex justify-between items-start mb-4"><h3 className={`text-2xl font-semibold ${colors.textPrimary}`}>{isDebtor?loan.lenderName:loan.debtorName}</h3><span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${isDebtor?`bg-pink-100 text-pink-700 dark:bg-pink-800 dark:text-pink-200`:`bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200`}`}>{isDebtor?'Debes':'Te Deben'}</span></div><p className={`text-3xl font-bold text-${colors.primaryAccent}-${theme==='light'?600:400} mb-2`}>{formatCurrencyDisplay(principal, currencyConfig)}</p>{isDebtor&&loan.monthlyPayment>0&&<p className={`text-base ${colors.textSecondary}`}>Cuota Sugerida: {formatCurrencyDisplay(loan.monthlyPayment, currencyConfig)}/mes</p>}<p className={`text-base ${colors.textSecondary}`}>{isDebtor?'Inicio Préstamo':'Otorgado'}: {formatDate(isDebtor?loan.startDate:loan.grantDate, 'descriptive')}</p><p className={`text-base ${colors.textSecondary}`}>Plazo: {loan.term} {loan.termUnit==='months'?'meses':'años'}</p>
    {!isFullyPaid && <p className={`text-base ${colors.textSecondary} mt-1`}>{isDebtor ? 'Próxima Cuota Aprox.' : 'Próximo Cobro Aprox.'}: {nextPaymentDisplayDate}</p>}
    <div className="mt-4"><div className={`flex justify-between text-sm ${colors.textSecondary} mb-1.5`}><span>{isFullyPaid ? (isDebtor ? "¡Deuda Pagada!" : "¡Cobrado!") : (isDebtor ? "Pagado:" : "Recibido:")} {formatCurrencyDisplay(totalPaidOrReceived, currencyConfig)}</span><span>{isFullyPaid ? "" : `Pendiente: ${formatCurrencyDisplay(balance, currencyConfig)}`}</span></div><div className={`w-full ${theme==='light'?'bg-slate-200':'bg-slate-700'} rounded-full h-3.5`}><div className={`${isFullyPaid ? 'bg-green-500' : `bg-${colors.primaryAccent}-${theme==='light'?500:400}`} h-3.5 rounded-full transition-width duration-500`} style={{width:`${Math.min(progress,100)}%`}}></div></div></div>
    <div className={`mt-5 pt-4 border-t ${colors.border} flex justify-between items-center`}>
        <button onClick={()=>openModal('recordLoanPayment',loan)} disabled={isFullyPaid} className={`btn-secondary text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all ${isFullyPaid ? 'bg-gray-400 cursor-not-allowed' : `bg-green-500 hover:bg-green-600 text-white`}`}>Registrar Abono</button>
        <div className="flex space-x-2"><button onClick={()=>openModal('editLoan',loan)} className={`p-2.5 text-${colors.primaryAccent}-${theme==='light'?500:400} hover:text-${colors.primaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Editar"><Edit3 size={20}/></button><button onClick={()=>deleteLoan('loans',loan.id)} className={`p-2.5 text-${colors.secondaryAccent}-${theme==='light'?500:400} hover:text-${colors.secondaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Eliminar"><Trash2 size={20}/></button></div></div></div>);}; 
    return(
        <div className="space-y-8"> 
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4"><h2 className={`text-4xl font-bold ${colors.textPrimary}`}>Gestión de Préstamos</h2></div> 
            <div><h3 className={`text-2xl font-semibold ${colors.textSecondary} mb-6`}>Préstamos Personales (Deudas)</h3>{debtorLoans.length===0?(<EmptyState icon={Landmark} message="No tienes deudas."/>):(<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{debtorLoans.map(l=><LoanCard key={l.id} loan={l}/>)}</div>)}</div> 
            <div><h3 className={`text-2xl font-semibold ${colors.textSecondary} mb-6`}>Préstamos Otorgados (Acreedor)</h3>{creditorLoans.length===0?(<EmptyState icon={Users} message="No has otorgado préstamos."/>):(<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{creditorLoans.map(l=><LoanCard key={l.id} loan={l}/>)}</div>)}</div> 
            <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40"><button onClick={()=>openModal('addLoan')} className={`bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} text-white font-semibold p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-${colors.primaryAccent}-${theme==='light'?300:600} focus:ring-opacity-50 flex items-center`} aria-label="Agregar Préstamo"><PlusCircle size={28}/><span className="ml-2.5 hidden sm:inline text-base">Nuevo Préstamo</span></button></div>
        </div>
    );
};

const LoanFormModal = ({ isOpen, onClose, addLoan, updateLoan, editingLoan, initialLoanTypeFromModal }) => {
    const { colors, theme } = useTheme(); const isEditing=!!editingLoan;
    const detInitType=()=>{if(isEditing)return editingLoan.type;if(initialLoanTypeFromModal)return initialLoanTypeFromModal;return'debtor';};
    const [loanType,setLoanType]=useState(detInitType());
    const [partyName,setPartyName]=useState('');const [amount,setAmount]=useState(null);const [interestRate,setInterestRate]=useState('');const [term,setTerm]=useState('');const [termUnit,setTermUnit]=useState('months');const [startDate,setStartDate]=useState(formatDate(new Date()));const [monthlyPayment,setMonthlyPayment]=useState(null);const [interestType,setInterestType]=useState('annual');const [errors,setErrors]=useState({});
    useEffect(()=>{const typeToUse=detInitType();setLoanType(typeToUse);if(editingLoan){setPartyName(editingLoan.type==='debtor'?editingLoan.lenderName:editingLoan.debtorName);setAmount(parseFloat((editingLoan.type==='debtor'?editingLoan.totalLoanAmount:editingLoan.amountLoaned)||0));setInterestRate(editingLoan.interestRate?.toString()||'');setTerm(editingLoan.term?.toString()||'');setTermUnit(editingLoan.termUnit);setStartDate(formatDate(editingLoan.type==='debtor'?editingLoan.startDate:editingLoan.grantDate));if(editingLoan.type==='debtor')setMonthlyPayment(parseFloat(editingLoan.monthlyPayment||0));if(editingLoan.type==='creditor')setInterestType(editingLoan.interestType||'annual');}else{setPartyName('');setAmount(null);setInterestRate('');setTerm('');setTermUnit('months');setStartDate(formatDate(new Date()));setMonthlyPayment(null);setInterestType('annual');}setErrors({});},[editingLoan,isOpen,initialLoanTypeFromModal]);
    const validate=()=>{const e={};if(!partyName.trim())e.partyName="Nombre obligatorio.";if(amount===null||isNaN(amount)||amount<=0)e.amount="Cantidad positiva.";if(!interestRate.trim()||isNaN(parseFloat(interestRate))||parseFloat(interestRate)<0)e.interestRate="Tasa de interés válida.";if(!term.trim()||isNaN(parseInt(term))||parseInt(term)<=0)e.term="Plazo positivo.";if(!startDate)e.startDate="Fecha obligatoria.";if(loanType==='debtor'&&(monthlyPayment===null||isNaN(monthlyPayment)||monthlyPayment<=0))e.monthlyPayment="Cuota mensual positiva.";setErrors(e);return Object.keys(e).length===0;};
    const handleSubmit=async(ev)=>{ev.preventDefault();if(!validate())return;let d={type:loanType,interestRate:parseFloat(interestRate),term:parseInt(term),termUnit, paymentsMade: editingLoan?.paymentsMade || [], paymentsReceived: editingLoan?.paymentsReceived || []};if(loanType==='debtor')d={...d,lenderName:partyName,totalLoanAmount:parseFloat(amount),startDate,monthlyPayment:parseFloat(monthlyPayment)};else d={...d,debtorName:partyName,amountLoaned:parseFloat(amount),grantDate:startDate,interestType};if(editingLoan)await updateLoan('loans',editingLoan.id,d);else await addLoan('loans',d);onClose();};
    const title=isEditing?(loanType==='debtor'?'Editar Préstamo (Deuda)':'Editar Préstamo Otorgado'):'Agregar Nuevo Préstamo';
    return(
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-5"> 
                {!isEditing&&<div><label className={`block text-base font-medium ${colors.textSecondary} mb-2`}>Tipo de Préstamo</label><div className="flex space-x-4"><button type="button" onClick={()=>setLoanType('debtor')} className={`flex-1 p-3.5 rounded-xl border text-base transition-all ${loanType==='debtor'?`bg-${colors.primaryAccent}-${theme==='light'?500:400} text-white border-${colors.primaryAccent}-${theme==='light'?500:400} shadow-lg`:`${colors.inputBg} ${colors.textSecondary} ${colors.inputBorder} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} hover:shadow-md`}`}>Yo Debo (Deuda)</button><button type="button" onClick={()=>setLoanType('creditor')} className={`flex-1 p-3.5 rounded-xl border text-base transition-all ${loanType==='creditor'?`bg-green-500 text-white border-green-500 shadow-lg`:`${colors.inputBg} ${colors.textSecondary} ${colors.inputBorder} hover:border-green-400 hover:shadow-md`}`}>Me Deben (Acreedor)</button></div></div>} 
                <div><label htmlFor="loan-partyName" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>{loanType==='debtor'?'Prestamista':'Deudor'}</label><input type="text" id="loan-partyName" value={partyName} onChange={e=>setPartyName(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.partyName&&<p className="text-red-500 text-sm mt-1.5">{errors.partyName}</p>}</div> 
                <div><label htmlFor="loan-amount" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>{loanType==='debtor'?'Cantidad Total Préstamo':'Cantidad Prestada'}</label><NumericInput value={amount} onChange={setAmount} placeholder="0" />{errors.amount&&<p className="text-red-500 text-sm mt-1.5">{errors.amount}</p>}</div>
                <div><label htmlFor="loan-interestRate" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Tasa Interés ({loanType==='creditor'&&interestType==='annual'?'Anual %':(loanType==='creditor'&&interestType==='fixed'?'Fija Total $':'Anual %')})</label><input type="text" id="loan-interestRate" value={interestRate} onChange={e=>setInterestRate(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.interestRate&&<p className="text-red-500 text-sm mt-1.5">{errors.interestRate}</p>}</div>
                {loanType==='creditor'&&<div><label htmlFor="loan-interestType" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Tipo Interés</label><select id="loan-interestType" value={interestType} onChange={e=>setInterestType(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}><option value="annual">Anual (%)</option><option value="fixed">Fija (Monto)</option></select></div>}
                <div className="grid grid-cols-2 gap-5"> 
                    <div><label htmlFor="loan-term" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Plazo</label><input type="number" id="loan-term" value={term} onChange={e=>setTerm(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.term&&<p className="text-red-500 text-sm mt-1.5">{errors.term}</p>}</div>
                    <div><label htmlFor="loan-termUnit" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Unidad Plazo</label><select id="loan-termUnit" value={termUnit} onChange={e=>setTermUnit(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}><option value="months">Meses</option><option value="years">Años</option></select></div>
                </div>
                <div><label htmlFor="loan-startDate" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>{loanType==='debtor'?'Fecha Inicio':'Fecha Otorgamiento'}</label><input type="date" id="loan-startDate" value={startDate} onChange={e=>setStartDate(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>{errors.startDate&&<p className="text-red-500 text-sm mt-1.5">{errors.startDate}</p>}</div>
                {loanType==='debtor'&&<div><label htmlFor="loan-monthlyPayment" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Cuota Mensual</label><NumericInput value={monthlyPayment} onChange={setMonthlyPayment} placeholder="0" />{errors.monthlyPayment&&<p className="text-red-500 text-sm mt-1.5">{errors.monthlyPayment}</p>}</div>}
                <div className="flex justify-end space-x-4 pt-3"><button type="button" onClick={onClose} className={`btn-secondary px-6 py-3 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} text-base`}>Cancelar</button><button type="submit" className={`btn-primary bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} px-6 py-3 text-base`}>{editingLoan?'Actualizar':'Agregar'}</button></div> 
            </form>
        </Modal>
    );
};

// --- Savings Goals Management ---
const SAVINGS_GOAL_ICONS = {
    PiggyBank, Gift, Car, Home, Plane, Briefcase, GraduationCap, ShoppingBag, CircleDollarSign, TrendingUpIcon, Target
};
const DEFAULT_GOAL_ICON = 'Target';

const SavingsGoalManager = ({ goals, openModal, deleteGoal, addFSItem, updateFSItem }) => {
    const { colors, theme } = useTheme();
    const { currencyConfig } = useSettings();

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <h2 className={`text-4xl font-bold ${colors.textPrimary}`}>Metas de Ahorro</h2>
            </div>

            {goals.length === 0 ? (
                <EmptyState 
                    icon={Target} 
                    message="Aún no tienes metas de ahorro definidas."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {goals.map(goal => {
                        const IconComponent = SAVINGS_GOAL_ICONS[goal.iconName] || SAVINGS_GOAL_ICONS[DEFAULT_GOAL_ICON];
                        const progress = goal.targetAmount > 0 ? ((goal.currentAmount || 0) / goal.targetAmount) * 100 : 0;
                        return (
                            <div key={goal.id} className={`${colors.card} p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03]`}>
                                <div className="flex items-center mb-4">
                                    <IconComponent size={36} className={`mr-4 text-${colors.primaryAccent}-${theme === 'light' ? 500 : 400}`} />
                                    <h3 className={`text-2xl font-semibold ${colors.textPrimary}`}>{goal.name}</h3>
                                </div>
                                <div className="mb-3">
                                    <p className={`text-sm ${colors.textSecondary}`}>Objetivo: {formatCurrencyDisplay(goal.targetAmount, currencyConfig)}</p>
                                    <p className={`text-sm ${colors.textSecondary}`}>Ahorrado: {formatCurrencyDisplay(goal.currentAmount || 0, currencyConfig)}</p>
                                    {goal.targetDate && <p className={`text-sm ${colors.textSecondary}`}>Fecha Límite: {formatDate(goal.targetDate, 'descriptive')}</p>}
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-1">
                                    <div className={`bg-${colors.primaryAccent}-${theme === 'light' ? 500 : 400} h-2.5 rounded-full`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                </div>
                                <p className={`text-xs text-right ${colors.textSecondary}`}>{progress.toFixed(1)}% completado</p>
                                
                                <div className={`mt-5 pt-4 border-t ${colors.border} flex justify-between items-center`}>
                                    <button 
                                        onClick={() => openModal('addFundsToGoal', goal)}
                                        className={`btn-secondary bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all`}
                                    >
                                        Añadir Fondos
                                    </button>
                                    <div className="flex space-x-2">
                                        <button onClick={() => openModal('editGoal', goal)} className={`p-2.5 text-${colors.primaryAccent}-${theme==='light'?500:400} hover:text-${colors.primaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Editar Meta"><Edit3 size={20}/></button>
                                        <button onClick={() => deleteGoal('goals', goal.id)} className={`p-2.5 text-${colors.secondaryAccent}-${theme==='light'?500:400} hover:text-${colors.secondaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Eliminar Meta"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
             <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40"><button onClick={()=>openModal('addGoal')} className={`bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} text-white font-semibold p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-${colors.primaryAccent}-${theme==='light'?300:600} focus:ring-opacity-50 flex items-center`} aria-label="Crear Meta"><PlusCircle size={28}/><span className="ml-2.5 hidden sm:inline text-base">Nueva Meta</span></button></div>
        </div>
    );
};

const SavingsGoalFormModal = ({ isOpen, onClose, addGoal, updateGoal, editingGoal }) => {
    const { colors, theme } = useTheme();
    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState(null);
    const [targetDate, setTargetDate] = useState('');
    const [selectedIcon, setSelectedIcon] = useState(DEFAULT_GOAL_ICON);
    const [errors, setErrors] = useState({});

    const availableIcons = Object.keys(SAVINGS_GOAL_ICONS);

    useEffect(() => {
        if (editingGoal) {
            setName(editingGoal.name || '');
            setTargetAmount(parseFloat(editingGoal.targetAmount || 0));
            setTargetDate(editingGoal.targetDate ? formatDate(editingGoal.targetDate) : '');
            setSelectedIcon(editingGoal.iconName || DEFAULT_GOAL_ICON);
        } else {
            setName('');
            setTargetAmount(null);
            setTargetDate('');
            setSelectedIcon(DEFAULT_GOAL_ICON);
        }
        setErrors({});
    }, [editingGoal, isOpen]);

    const validate = () => {
        const newErrors = {};
        if (!name.trim()) newErrors.name = "El nombre de la meta es obligatorio.";
        if (targetAmount === null || isNaN(targetAmount) || targetAmount <= 0) newErrors.targetAmount = "El monto objetivo debe ser un número positivo.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        const goalData = {
            name,
            targetAmount: parseFloat(targetAmount),
            currentAmount: editingGoal ? (editingGoal.currentAmount || 0) : 0,
            targetDate: targetDate || null,
            iconName: selectedIcon,
        };
        if (editingGoal) {
            await updateGoal('goals', editingGoal.id, goalData);
        } else {
            await addGoal('goals', goalData);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingGoal ? 'Editar Meta de Ahorro' : 'Crear Meta de Ahorro'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="goal-name" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Nombre de la Meta</label>
                    <input type="text" id="goal-name" value={name} onChange={e => setName(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`} />
                    {errors.name && <p className="text-red-500 text-sm mt-1.5">{errors.name}</p>}
                </div>
                <div>
                    <label htmlFor="goal-targetAmount" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Monto Objetivo</label>
                    <NumericInput value={targetAmount} onChange={setTargetAmount} placeholder="0" />
                    {errors.targetAmount && <p className="text-red-500 text-sm mt-1.5">{errors.targetAmount}</p>}
                </div>
                <div>
                    <label htmlFor="goal-targetDate" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Fecha Límite (Opcional)</label>
                    <input type="date" id="goal-targetDate" value={targetDate} onChange={e => setTargetDate(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`} />
                </div>
                <div>
                    <label className={`block text-base font-medium ${colors.textSecondary} mb-2`}>Selecciona un Ícono</label>
                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-3">
                        {availableIcons.map(iconKey => {
                            const IconComponent = SAVINGS_GOAL_ICONS[iconKey];
                            return (
                                <button
                                    type="button"
                                    key={iconKey}
                                    onClick={() => setSelectedIcon(iconKey)}
                                    className={`p-3 rounded-xl border transition-all duration-200 flex justify-center items-center
                                        ${selectedIcon === iconKey 
                                            ? `bg-${colors.primaryAccent}-${theme === 'light' ? 500 : 400} text-white border-${colors.primaryAccent}-${theme === 'light' ? 500 : 400} shadow-lg scale-110`
                                            : `${colors.inputBg} ${colors.textSecondary} ${colors.inputBorder} hover:border-${colors.primaryAccent}-${theme === 'light' ? 300 : 600} hover:shadow-md`}
                                    `}
                                    title={iconKey}
                                >
                                    <IconComponent size={28} />
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex justify-end space-x-4 pt-3">
                    <button type="button" onClick={onClose} className={`btn-secondary px-6 py-3 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} text-base`}>Cancelar</button>
                    <button type="submit" className={`btn-primary bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} px-6 py-3 text-base`}>{editingGoal ? 'Actualizar Meta' : 'Crear Meta'}</button>
                </div>
            </form>
        </Modal>
    );
};

const AddFundsToGoalModal = ({ isOpen, onClose, goal, updateGoal, addTransaction }) => {
    const { colors, theme } = useTheme();
    const { currencyConfig } = useSettings();
    const [amountToAdd, setAmountToAdd] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setAmountToAdd(null);
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (amountToAdd === null || isNaN(amountToAdd) || amountToAdd <= 0) {
            setError("Por favor, ingresa un monto válido.");
            return;
        }

        const newCurrentAmount = (goal.currentAmount || 0) + parseFloat(amountToAdd);
        if (newCurrentAmount > goal.targetAmount) {
            setError(`No puedes añadir más del objetivo. Necesitas ${formatCurrencyDisplay(goal.targetAmount - (goal.currentAmount || 0), currencyConfig)} para alcanzar la meta.`);
            return;
        }
        
        try {
            await updateGoal('goals', goal.id, { currentAmount: newCurrentAmount });
            const transactionData = {
                name: `Contribución a meta: ${goal.name}`,
                amount: parseFloat(amountToAdd),
                date: formatDate(new Date()),
                type: 'expense',
                category: 'Metas de Ahorro',
                goalId: goal.id, 
            };
            await addTransaction('transactions', transactionData);
            onClose();
        } catch (err) {
            console.error("Error adding funds to goal:", err);
            setError("Ocurrió un error al añadir fondos.");
        }
    };

    if (!goal) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Añadir Fondos a: ${goal.name}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className={`${colors.textSecondary} text-sm`}>Meta Actual: {formatCurrencyDisplay(goal.currentAmount || 0, currencyConfig)} / {formatCurrencyDisplay(goal.targetAmount, currencyConfig)}</p>
                </div>
                <div>
                    <label htmlFor="amount-to-add" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Monto a Añadir</label>
                    <NumericInput value={amountToAdd} onChange={setAmountToAdd} placeholder="0" />
                    {error && <p className="text-red-500 text-sm mt-1.5">{error}</p>}
                </div>
                <div className="flex justify-end space-x-4 pt-3">
                    <button type="button" onClick={onClose} className={`btn-secondary px-6 py-3 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} text-base`}>Cancelar</button>
                    <button type="submit" className={`btn-primary bg-green-500 hover:bg-green-600 px-6 py-3 text-base flex items-center`}><Save size={18} className="mr-2"/>Añadir Fondos</button>
                </div>
            </form>
        </Modal>
    );
};

const RecordLoanPaymentModal = ({ isOpen, onClose, loan, updateLoan, addTransaction }) => {
    const { colors, theme } = useTheme();
    const { currencyConfig } = useSettings();
    const [paymentAmount, setPaymentAmount] = useState(null);
    const [paymentDate, setPaymentDate] = useState(formatDate(new Date()));
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPaymentAmount(null);
            setPaymentDate(formatDate(new Date()));
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (paymentAmount === null || isNaN(paymentAmount) || paymentAmount <= 0) {
            setError("Por favor, ingresa un monto de abono válido.");
            return;
        }
        if (!paymentDate) {
            setError("Por favor, selecciona una fecha para el abono.");
            return;
        }

        const newPayment = { amount: parseFloat(paymentAmount), date: Timestamp.fromDate(new Date(paymentDate + "T00:00:00")) };
        let updatedLoanData = {};
        let transactionData = {};

        if (loan.type === 'debtor') {
            updatedLoanData.paymentsMade = arrayUnion(newPayment);
            transactionData = {
                name: `Abono a préstamo: ${loan.lenderName}`,
                amount: parseFloat(paymentAmount),
                date: paymentDate,
                type: 'expense',
                category: 'Pago Préstamo',
                loanId: loan.id,
            };
        } else { // creditor
            updatedLoanData.paymentsReceived = arrayUnion(newPayment);
            transactionData = {
                name: `Abono recibido de: ${loan.debtorName}`,
                amount: parseFloat(paymentAmount),
                date: paymentDate,
                type: 'income',
                category: 'Cobro Préstamo',
                loanId: loan.id,
            };
        }
        
        try {
            await updateLoan('loans', loan.id, updatedLoanData);
            await addTransaction('transactions', transactionData);
            onClose();
        } catch (err) {
            console.error("Error recording loan payment:", err);
            setError("Ocurrió un error al registrar el abono.");
        }
    };

    if (!loan) return null;
    const principal = parseFloat(loan.totalLoanAmount || loan.amountLoaned || 0);
    const payments = loan.type === 'debtor' ? loan.paymentsMade : loan.paymentsReceived;
    const totalPaidOrReceived = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingBalance = Math.max(0, principal - totalPaidOrReceived);


    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Registrar Abono: ${loan.type === 'debtor' ? loan.lenderName : loan.debtorName}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className={`${colors.textSecondary} text-sm`}>Monto Total: {formatCurrencyDisplay(principal, currencyConfig)}</p>
                    <p className={`${colors.textSecondary} text-sm`}>Total Abonado: {formatCurrencyDisplay(totalPaidOrReceived, currencyConfig)}</p>
                    <p className={`${colors.textSecondary} text-sm font-semibold`}>Saldo Pendiente: {formatCurrencyDisplay(remainingBalance, currencyConfig)}</p>
                </div>
                <div>
                    <label htmlFor="payment-amount" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Monto del Abono</label>
                    <NumericInput value={paymentAmount} onChange={setPaymentAmount} placeholder="0" />
                </div>
                <div>
                    <label htmlFor="payment-date" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Fecha del Abono</label>
                    <input type="date" id="payment-date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>
                </div>
                {error && <p className="text-red-500 text-sm -mt-2">{error}</p>}
                <div className="flex justify-end space-x-4 pt-3">
                    <button type="button" onClick={onClose} className={`btn-secondary px-6 py-3 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} text-base`}>Cancelar</button>
                    <button type="submit" className={`btn-primary bg-green-500 hover:bg-green-600 px-6 py-3 text-base flex items-center`}><Save size={18} className="mr-2"/>Registrar Abono</button>
                </div>
            </form>
        </Modal>
    );
};

// --- Budget Management ---
const BudgetManager = ({ budgets, transactions, openModal, deleteBudget, addFSItem, updateFSItem }) => {
    const { colors, theme } = useTheme();
    const { currencyConfig } = useSettings();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const currentMonthBudgets = useMemo(() => {
        return budgets.filter(b => b.month === selectedMonth && b.year === selectedYear);
    }, [budgets, selectedMonth, selectedYear]);

    const expensesForMonth = useMemo(() => {
        return transactions.filter(t => 
            t.type === 'expense' && 
            t.date &&
            new Date(formatDate(t.date) + "T00:00:00").getMonth() === selectedMonth &&
            new Date(formatDate(t.date) + "T00:00:00").getFullYear() === selectedYear
        );
    }, [transactions, selectedMonth, selectedYear]);

    const getCategorySpentAmount = (category) => {
        return expensesForMonth
            .filter(t => t.category === category)
            .reduce((sum, t) => sum + (t.amount || 0), 0);
    };
    
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i);


    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <h2 className={`text-4xl font-bold ${colors.textPrimary}`}>Presupuestos Mensuales</h2>
                <div className="flex gap-2">
                    <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className={`input-style rounded-lg py-2 px-3 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder}`}>
                        {months.map((month, index) => <option key={index} value={index}>{month}</option>)}
                    </select>
                    <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className={`input-style rounded-lg py-2 px-3 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder}`}>
                        {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>

            {currentMonthBudgets.length === 0 ? (
                <EmptyState 
                    icon={Archive} 
                    message={`No hay presupuestos definidos para ${months[selectedMonth]} de ${selectedYear}.`}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {currentMonthBudgets.map(budget => {
                        const spentAmount = getCategorySpentAmount(budget.category);
                        const remainingAmount = budget.amount - spentAmount;
                        const progress = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0;
                        const progressBarColor = progress > 100 ? 'bg-red-500' : (progress > 75 ? 'bg-yellow-500' : `bg-${colors.primaryAccent}-${theme==='light'?500:400}`);

                        return (
                            <div key={budget.id} className={`${colors.card} p-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.03]`}>
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className={`text-2xl font-semibold ${colors.textPrimary}`}>{budget.category}</h3>
                                    <span className={`text-sm font-bold ${progress > 100 ? 'text-red-500' : colors.textPrimary}`}>
                                        {formatCurrencyDisplay(spentAmount, currencyConfig)} / {formatCurrencyDisplay(budget.amount, currencyConfig)}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-1">
                                    <div className={`${progressBarColor} h-3 rounded-full`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                </div>
                                <p className={`text-xs text-right ${colors.textSecondary}`}>
                                    {progress > 100 
                                        ? `Excedido en ${formatCurrencyDisplay(spentAmount - budget.amount, currencyConfig)} (${progress.toFixed(1)}%)` 
                                        : `Restante: ${formatCurrencyDisplay(remainingAmount, currencyConfig)} (${(100-progress).toFixed(1)}%)`}
                                </p>
                                <div className={`mt-5 pt-4 border-t ${colors.border} flex justify-end space-x-3`}>
                                    <button onClick={() => openModal('editBudget', budget)} className={`p-2.5 text-${colors.primaryAccent}-${theme==='light'?500:400} hover:text-${colors.primaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Editar Presupuesto"><Edit3 size={20}/></button>
                                    <button onClick={() => deleteBudget('budgets', budget.id)} className={`p-2.5 text-${colors.secondaryAccent}-${theme==='light'?500:400} hover:text-${colors.secondaryAccent}-${theme==='light'?700:300} rounded-full ${colors.hoverBg} transition-colors`} title="Eliminar Presupuesto"><Trash2 size={20}/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-40"><button onClick={()=>openModal('addBudget')} className={`bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} text-white font-semibold p-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-${colors.primaryAccent}-${theme==='light'?300:600} focus:ring-opacity-50 flex items-center`} aria-label="Crear Presupuesto"><PackagePlus size={28}/><span className="ml-2.5 hidden sm:inline text-base">Nuevo Presupuesto</span></button></div>
        </div>
    );
};

const BudgetFormModal = ({ isOpen, onClose, addBudget, updateBudget, editingBudget, transactions }) => {
    const { colors, theme } = useTheme();
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState(null);
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [errors, setErrors] = useState({});

    const expenseCategories = useMemo(() => {
        const uniqueCategories = new Set(transactions.filter(t => t.type === 'expense' && t.category).map(t => t.category));
        return Array.from(uniqueCategories).sort();
    }, [transactions]);

    useEffect(() => {
        if (editingBudget) {
            setCategory(editingBudget.category || '');
            setAmount(parseFloat(editingBudget.amount || 0));
            setMonth(editingBudget.month !== undefined ? editingBudget.month : new Date().getMonth());
            setYear(editingBudget.year || new Date().getFullYear());
        } else {
            setCategory('');
            setAmount(null);
            setMonth(new Date().getMonth());
            setYear(new Date().getFullYear());
        }
        setErrors({});
    }, [editingBudget, isOpen]);

    const validate = () => {
        const newErrors = {};
        if (!category.trim()) newErrors.category = "La categoría es obligatoria.";
        if (amount === null || isNaN(amount) || amount <= 0) newErrors.amount = "El monto presupuestado debe ser un número positivo.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        const budgetData = { category, amount: parseFloat(amount), month, year };
        if (editingBudget) {
            await updateBudget('budgets', editingBudget.id, budgetData);
        } else {
            await addBudget('budgets', budgetData);
        }
        onClose();
    };
    
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingBudget ? 'Editar Presupuesto' : 'Crear Presupuesto'} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="budget-category" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Categoría</label>
                    <input list="expense-categories-datalist" type="text" id="budget-category" value={category} onChange={e => setCategory(e.target.value)} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}/>
                    <datalist id="expense-categories-datalist">
                        {expenseCategories.map(cat => <option key={cat} value={cat} />)}
                        <option value="Otros">Otros (Escribir)</option>
                    </datalist>
                    {errors.category && <p className="text-red-500 text-sm mt-1.5">{errors.category}</p>}
                </div>
                <div>
                    <label htmlFor="budget-amount" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Monto Presupuestado</label>
                    <NumericInput value={amount} onChange={setAmount} placeholder="0" />
                    {errors.amount && <p className="text-red-500 text-sm mt-1.5">{errors.amount}</p>}
                </div>
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label htmlFor="budget-month" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Mes</label>
                        <select id="budget-month" value={month} onChange={e => setMonth(parseInt(e.target.value))} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}>
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="budget-year" className={`block text-base font-medium ${colors.textSecondary} mb-1.5`}>Año</label>
                        <select id="budget-year" value={year} onChange={e => setYear(parseInt(e.target.value))} className={`input-style w-full rounded-xl py-3 px-4 text-base ${colors.inputBg} ${colors.textPrimary} border ${colors.inputBorder} focus:ring-2 focus:ring-${colors.primaryAccent}-${theme==='light'?400:500} focus:border-${colors.primaryAccent}-${theme==='light'?400:500} transition-shadow`}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end space-x-4 pt-3">
                    <button type="button" onClick={onClose} className={`btn-secondary px-6 py-3 ${colors.hoverBg} border ${colors.border} hover:border-${colors.primaryAccent}-${theme==='light'?300:600} text-base`}>Cancelar</button>
                    <button type="submit" className={`btn-primary bg-${colors.primaryAccent}-${theme==='light'?500:400} hover:bg-${colors.primaryAccent}-${theme==='light'?600:500} px-6 py-3 text-base`}>{editingBudget ? 'Actualizar Presupuesto' : 'Crear Presupuesto'}</button>
                </div>
            </form>
        </Modal>
    );
};


export default function ProvidedApp() {return (<ThemeProvider><SettingsProvider><App/></SettingsProvider></ThemeProvider>);}

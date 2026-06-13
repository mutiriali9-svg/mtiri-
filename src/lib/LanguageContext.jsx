import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

export const t_data = {
  ar: {
    // Nav
    dashboard: 'لوحة التحكم', units: 'الوحدات السكنية', payments: 'الدفعات',
    expenses: 'المصاريف', reports: 'التقارير', investors: 'المستثمرون',
    savings: 'الادخار', dataEntry: 'إدخال البيانات',
    owner: 'مالك', dataEntryRole: 'إدخال بيانات', logout: 'تسجيل الخروج',

    // Common
    add: 'إضافة', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل',
    search: 'بحث', all: 'الكل', notes: 'ملاحظات', date: 'التاريخ',
    amount: 'المبلغ', saving_: 'جاري الحفظ...', uploading: 'جاري الرفع...',
    apply: 'تطبيق الفلتر', reset: 'إعادة تعيين', clear: 'مسح', year: 'السنة',
    total: 'الإجمالي', status: 'الحالة', actions: '',
    noData: 'لا توجد بيانات', from: 'من', to: 'إلى', details: 'التفاصيل',

    // Status
    occupied: 'مؤجرة', vacant: 'شاغرة', maintenance: 'صيانة',
    paid: 'مدفوع', pending: 'معلق', late: 'متأخر',

    // Payment methods
    cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك', other: 'أخرى',

    // Expense categories
    maintenance_cat: 'صيانة', salary: 'رواتب', utilities: 'خدمات', equipment: 'معدات',
    cleaning: 'نظافة', admin: 'إدارية', marketing: 'تسويق', insurance: 'تأمين',
    savings_cat: 'مدخر في وديعة', other_cat: 'أخرى',

    // Dashboard
    dashTitle: 'لوحة التحكم', dashSub: 'نظرة شاملة على أداء المحفظة العقارية',
    netIncome: 'صافي الدخل', totalCollected: 'إجمالي المحصل',
    totalExpenses_: 'إجمالي المصاريف', occupancyRate: 'نسبة الإشغال',
    revenueMinusExpenses: 'إيرادات - مصاريف',
    monthlyPayments: 'الدفعات الشهرية', expiringContracts: 'عقود تنتهي قريباً',
    noPaymentsYet: 'لا توجد بيانات دفعات بعد', noExpiring: 'لا توجد عقود تنتهي خلال 90 يوم',
    recentPayments: 'آخر الدفعات', viewAll: 'عرض الكل',
    tenant: 'المستأجر', unit: 'الشقة', paymentDate: 'التاريخ',
    noPaymentsRegistered: 'لا توجد دفعات مسجلة',
    fromDate: 'من تاريخ', toDate: 'إلى تاريخ',
    days: 'يوم',
    paymentsCount: 'دفعة مسجلة',
    expensesCount: 'مصروف مسجل',

    // Units
    unitsTitle: 'الوحدات السكنية', addUnit: 'إضافة وحدة',
    unitNumber: 'رقم الشقة', tenantName: 'اسم المستأجر', nationality: 'الجنسية',
    annualRent: 'الإيجار السنوي', paymentPlan: 'خطة الدفع', contractEnd: 'انتهاء العقد',
    searchUnits: 'بحث برقم الشقة أو اسم المستأجر...',
    allStatuses: 'كل الحالات', editUnit: 'تعديل بيانات الوحدة', addNewUnit: 'إضافة وحدة جديدة',
    floor: 'الطابق', insurance: 'التأمين', ownerPhone: 'رقم المالك',
    contractStart: 'تاريخ بداية العقد', contractEndDate: 'تاريخ انتهاء العقد',
    contractImage: 'صورة العقد', uploadContract: 'رفع صورة العقد',
    viewContract: 'عرض العقد', noUnitsFound: 'لا توجد وحدات تطابق البحث',
    deleteUnitConfirm: 'هل أنت متأكد من حذف هذه الوحدة؟',
    unitUpdated: 'تم تحديث بيانات الوحدة', unitAdded: 'تمت إضافة الوحدة بنجاح',
    unitDeleted: 'تم حذف الوحدة', expired: 'منتهي',

    // Payments
    paymentsTitle: 'جدول الدفعات', registerPayment: 'تسجيل دفعة',
    searchPayments: 'بحث باسم المستأجر أو رقم الشقة...',
    totalShown: 'إجمالي المبالغ المعروضة', paymentCount: 'عدد الدفعات',
    dueMonth: 'مستحق لشهر', paymentMethod: 'طريقة الدفع',
    receiptNumber: 'رقم الإيصال', receiptImage: 'صورة الإيصال *',,
    uploadReceipt: 'رفع صورة الإيصال', editPayment: 'تعديل الدفعة',
    addPayment: 'تسجيل دفعة جديدة', savePayment: 'حفظ الدفعة',
    noPayments: 'لا توجد دفعات', deletePaymentConfirm: 'هل أنت متأكد من حذف هذه الدفعة؟',
    paymentUpdated: 'تم تحديث الدفعة', paymentAdded: 'تمت إضافة الدفعة بنجاح ✓',
    paymentDeleted: 'تم حذف الدفعة', noneUnit: '— بدون تحديد —',
    allStatuses_pay: 'كل الحالات', amountAED: 'المبلغ (د.إ) *',

    // Expenses
    expensesTitle: 'المصاريف والتكاليف', addExpense: 'إضافة مصروف',
    searchExpenses: 'بحث في التفاصيل أو المورد...', totalExpensesShown: 'إجمالي المصاريف المعروضة',
    expenseCount: 'عدد المصاريف', category: 'التصنيف', vendor: 'المورد / الجهة',
    invoiceNumber: 'رقم الفاتورة', invoiceImage: 'صورة الفاتورة',
    uploadInvoice: 'رفع صورة الفاتورة', editExpense: 'تعديل المصروف',
    addNewExpense: 'إضافة مصروف جديد', saveExpense: 'حفظ المصروف',
    expenseDetails: 'تفاصيل المصروف *', noExpenses: 'لا توجد مصاريف',
    deleteExpenseConfirm: 'هل أنت متأكد من حذف هذا المصروف؟',
    expenseUpdated: 'تم تحديث المصروف', expenseAdded: 'تمت إضافة المصروف بنجاح',
    expenseDeleted: 'تم حذف المصروف', allCategories: 'كل التصنيفات',
    optionalUnit: 'رقم الشقة (اختياري)',

    // Reports
    reportsTitle: 'التقارير المالية', reportsSubTitle: 'تحليل مالي شامل للمحفظة العقارية',
    totalRevenue: 'إجمالي الإيرادات', totalExpensesR: 'إجمالي المصاريف',
    netProfit: 'صافي الربح', profitMargin: 'هامش الربح',
    monthlyRevenueVsExpenses: 'الإيرادات مقابل المصاريف الشهرية',
    noDataForYear: 'لا توجد بيانات لهذه السنة', monthlyNetProfit: 'صافي الربح الشهري',
    expenseByCategory: 'توزيع المصاريف حسب التصنيف', noExpenseData: 'لا توجد مصاريف',
    monthlyFinancialSummary: 'الملخص المالي الشهري', month: 'الشهر',
    revenue: 'الإيرادات', net: 'صافي', margin: 'هامش الربح', totalRow: 'الإجمالي',
    monthlyNetProfitSub: 'صافي الربح الشهري', expenseCategorySub: 'توزيع المصاريف حسب التصنيف',

    // Investors
    investorsTitle: 'المستثمرون', filterByDate: 'تصفية بالتاريخ',
    totalRevenueI: 'إجمالي الإيرادات', totalExpensesI: 'إجمالي المصاريف',
    netProfitI: 'صافي الربح', clickForDetails: 'اضغط للتفاصيل',
    revenueDetails: 'تفاصيل الإيرادات', expensesDetails: 'تفاصيل المصاريف',
    profitSummary: 'ملخص صافي الربح', investorShares: 'حصص المستثمرين',
    totalShares: 'إجمالي النسب', investorName: 'المستثمر', sharePct: 'النسبة %',
    revShare: 'حصة من الإيرادات', expShare: 'حصة من المصاريف', netShare: 'صافي الحصة',
    totalRow_i: 'المجموع', noPaymentsPeriod: 'لا توجد دفعات في هذه الفترة',
    noExpensesPeriod: 'لا توجد مصاريف في هذه الفترة',
    description_col: 'الوصف', subTotal: 'المجموع',

    // Savings
    savingsTitle: 'الادخار', savingsSubTitle: 'المبالغ المدخرة في الوديعة',
    addSaving: 'إضافة مدخر', totalSavings: 'إجمالي المبالغ المدخرة في الوديعة',
    savingsRecord: 'سجل المبالغ المدخرة', noSavings: 'لا توجد مبالغ مدخرة بعد',
    addSavingTitle: 'إضافة مبلغ مدخر', savingsDescription: 'الوصف *',
    savingsAmount: 'المبلغ *', savingsDate: 'التاريخ *', savingAdded: 'تمت الإضافة بنجاح',
    savingDeleted: 'تم الحذف بنجاح', confirmDeleteSaving: 'هل تريد حذف هذا المبلغ المدخر؟',
    fillRequired: 'الرجاء ملء جميع الحقول المطلوبة',

    // DataEntry
    dataEntryTitle: 'إدخال البيانات', registerPaymentTab: 'تسجيل دفعة',
    addExpenseTab: 'إضافة مصروف', fullName: 'الاسم الكامل',
    savePaymentDE: 'حفظ الدفعة', saveExpenseDE: 'حفظ المصروف',
    paymentSavedSuccess: 'تم حفظ الدفعة بنجاح!', expenseSavedSuccess: 'تم حفظ المصروف بنجاح!',
    dueMonths: 'الأشهر المستحقة', uploadOrCapture: 'رفع صورة الإيصال أو التصوير',
    uploadOrCaptureInvoice: 'رفع صورة الفاتورة أو التصوير',

    // UnitDetails
    backToUnits: 'العودة إلى الوحدات', unitLabel: 'وحدة',
    noTenant: 'لا يوجد مستأجر', annualRentLabel: 'الإيجار السنوي',
    contractStartLabel: 'بداية العقد', contractEndLabel: 'انتهاء العقد',
    ownerPhoneLabel: 'رقم المالك', paymentPlanLabel: 'خطة الدفع',
    notesLabel: 'ملاحظات', totalCollectedLabel: 'إجمالي المحصّل',
    paymentCountLabel: 'عدد الدفعات', lastPayment: 'آخر دفعة',
    paymentRecord: 'سجل الدفعات', fromLabel: 'من', toLabel: 'إلى',
    periodTotal: 'إجمالي المحصّل في هذه الفترة', noPaymentsUnit: 'لا توجد دفعات مسجّلة لهذه الوحدة',
    noMatchingResults: 'لا توجد نتائج مطابقة للبحث', unitNotFound: 'الوحدة غير موجودة',
    receiptName: 'اسم الإيصال',

    // Access error
    accessRestricted: 'الوصول مقيّد',
    notRegistered: 'لم يتم تسجيلك في هذا التطبيق. يرجى التواصل مع المسؤول للحصول على الصلاحية.',
    ifError: 'إذا كنت تعتقد أن هذا خطأ، يمكنك:',
    checkAccount: 'التحقق من تسجيل الدخول بالحساب الصحيح',
    contactAdmin: 'التواصل مع مسؤول التطبيق للحصول على الوصول',
    tryLogout: 'تسجيل الخروج وإعادة الدخول',
  },
  en: {
    // Nav
    dashboard: 'Dashboard', units: 'Units', payments: 'Payments',
    expenses: 'Expenses', reports: 'Reports', investors: 'Investors',
    savings: 'Savings', dataEntry: 'Data Entry',
    owner: 'Owner', dataEntryRole: 'Data Entry', logout: 'Logout',

    // Common
    add: 'Add', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    search: 'Search', all: 'All', notes: 'Notes', date: 'Date',
    amount: 'Amount', saving_: 'Saving...', uploading: 'Uploading...',
    apply: 'Apply Filter', reset: 'Reset', clear: 'Clear', year: 'Year',
    total: 'Total', status: 'Status', actions: '',
    noData: 'No data', from: 'From', to: 'To', details: 'Details',

    // Status
    occupied: 'Occupied', vacant: 'Vacant', maintenance: 'Maintenance',
    paid: 'Paid', pending: 'Pending', late: 'Late',

    // Payment methods
    cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', other: 'Other',

    // Expense categories
    maintenance_cat: 'Maintenance', salary: 'Salary', utilities: 'Utilities', equipment: 'Equipment',
    cleaning: 'Cleaning', admin: 'Admin', marketing: 'Marketing', insurance: 'Insurance',
    savings_cat: 'Deposit Savings', other_cat: 'Other',

    // Dashboard
    dashTitle: 'Dashboard', dashSub: 'Comprehensive view of real estate portfolio performance',
    netIncome: 'Net Income', totalCollected: 'Total Collected',
    totalExpenses_: 'Total Expenses', occupancyRate: 'Occupancy Rate',
    revenueMinusExpenses: 'Revenue - Expenses',
    monthlyPayments: 'Monthly Collections', expiringContracts: 'Expiring Contracts',
    noPaymentsYet: 'No payment data yet', noExpiring: 'No contracts expiring within 90 days',
    recentPayments: 'Recent Payments', viewAll: 'View All',
    tenant: 'Tenant', unit: 'Unit', paymentDate: 'Date',
    noPaymentsRegistered: 'No payments registered',
    fromDate: 'From Date', toDate: 'To Date',
    days: 'days',
    paymentsCount: 'payments',
    expensesCount: 'expenses',

    // Units
    unitsTitle: 'Residential Units', addUnit: 'Add Unit',
    unitNumber: 'Unit No.', tenantName: 'Tenant Name', nationality: 'Nationality',
    annualRent: 'Annual Rent', paymentPlan: 'Payment Plan', contractEnd: 'Contract End',
    searchUnits: 'Search by unit number or tenant name...',
    allStatuses: 'All Statuses', editUnit: 'Edit Unit', addNewUnit: 'Add New Unit',
    floor: 'Floor', insurance: 'Insurance', ownerPhone: 'Owner Phone',
    contractStart: 'Contract Start Date', contractEndDate: 'Contract End Date',
    contractImage: 'Contract Image', uploadContract: 'Upload Contract',
    viewContract: 'View Contract', noUnitsFound: 'No units match search',
    deleteUnitConfirm: 'Are you sure you want to delete this unit?',
    unitUpdated: 'Unit updated', unitAdded: 'Unit added successfully',
    unitDeleted: 'Unit deleted', expired: 'Expired',
    edit: 'Edit', delete: 'Delete',
    uploading: 'Uploading...', saving_: 'Saving...', save: 'Save', cancel: 'Cancel', addNewUnit: 'Add New Unit',

    // Payments
    paymentsTitle: 'Payment Ledger', registerPayment: 'Register Payment',
    searchPayments: 'Search by tenant name or unit number...',
    totalShown: 'Total Amount Shown', paymentCount: 'Payment Count',
    dueMonth: 'Due Month', paymentMethod: 'Payment Method',
    receiptNumber: 'Receipt No.', receiptImage: 'Receipt Image (Optional)',
    uploadReceipt: 'Upload Receipt', editPayment: 'Edit Payment',
    addPayment: 'Register New Payment', savePayment: 'Save Payment',
    noPayments: 'No payments', deletePaymentConfirm: 'Are you sure you want to delete this payment?',
    paymentUpdated: 'Payment updated', paymentAdded: 'Payment added successfully ✓',
    paymentDeleted: 'Payment deleted', noneUnit: '— None —',
    allStatuses_pay: 'All Statuses', amountAED: 'Amount (AED) *',

    // Expenses
    expensesTitle: 'Expenses & Costs', addExpense: 'Add Expense',
    searchExpenses: 'Search by description or vendor...', totalExpensesShown: 'Total Expenses Shown',
    expenseCount: 'Expense Count', category: 'Category', vendor: 'Vendor',
    invoiceNumber: 'Invoice No.', invoiceImage: 'Invoice Image',
    uploadInvoice: 'Upload Invoice', editExpense: 'Edit Expense',
    addNewExpense: 'Add New Expense', saveExpense: 'Save Expense',
    expenseDetails: 'Expense Details *', noExpenses: 'No expenses',
    deleteExpenseConfirm: 'Are you sure you want to delete this expense?',
    expenseUpdated: 'Expense updated', expenseAdded: 'Expense added successfully',
    expenseDeleted: 'Expense deleted', allCategories: 'All Categories',
    optionalUnit: 'Unit No. (Optional)',

    // Reports
    reportsTitle: 'Financial Reports', reportsSubTitle: 'Comprehensive financial analysis of the real estate portfolio',
    totalRevenue: 'Total Revenue', totalExpensesR: 'Total Expenses',
    netProfit: 'Net Profit', profitMargin: 'Profit Margin',
    monthlyRevenueVsExpenses: 'Monthly Revenue vs Expenses',
    noDataForYear: 'No data for this year', monthlyNetProfit: 'Monthly Net Profit',
    expenseByCategory: 'Expense Breakdown by Category', noExpenseData: 'No expenses',
    monthlyFinancialSummary: 'Monthly Financial Summary', month: 'Month',
    revenue: 'Revenue', net: 'Net', margin: 'Profit Margin', totalRow: 'Total',
    monthlyNetProfitSub: 'Monthly Net Profit', expenseCategorySub: 'Expense Breakdown by Category',

    // Investors - English
    investorsTitle_en: 'Investors', filterByDate_en: 'Filter by Date',
    totalRevenueI_en: 'Total Revenue', totalExpensesI_en: 'Total Expenses',
    netProfitI_en: 'Net Profit', clickForDetails_en: 'Click for details',
    revenueDetails_en: 'Revenue Details', expensesDetails_en: 'Expenses Details',
    profitSummary_en: 'Net Profit Summary', investorShares_en: 'Investor Shares',
    totalShares_en: 'Total Shares', investorName_en: 'Investor', sharePct_en: 'Share %',
    revShare_en: 'Revenue Share', expShare_en: 'Expense Share', netShare_en: 'Net Share',
    totalRow_i_en: 'Total', noPaymentsPeriod_en: 'No payments in this period',
    noExpensesPeriod_en: 'No expenses in this period',
    description_col_en: 'Description', subTotal_en: 'Total',
    year_en: 'Year', selectYear_en: 'Select Year',

    // Savings - English
    savingsTitle_en: 'Savings', savingsSubTitle_en: 'Amounts saved in deposit',
    addSaving: 'Add Saving', totalSavings: 'Total Savings in Deposit',
    savingsRecord: 'Savings Record', noSavings: 'No savings yet',
    addSavingTitle: 'Add Saving Amount', savingsDescription: 'Description *',
    savingsAmount: 'Amount *', savingsDate: 'Date *', savingAdded: 'Added successfully',
    savingDeleted: 'Deleted successfully', confirmDeleteSaving: 'Delete this saving amount?',
    fillRequired: 'Please fill all required fields',

    // DataEntry - English
    dataEntryTitle_en: 'Data Entry', registerPaymentTab_en: 'Register Payment',
    addExpenseTab: 'Add Expense', fullName: 'Full Name',
    savePaymentDE: 'Save Payment', saveExpenseDE: 'Save Expense',
    paymentSavedSuccess: 'Payment saved successfully!', expenseSavedSuccess: 'Expense saved successfully!',
    dueMonths: 'Due Months', uploadOrCapture: 'Upload receipt or capture',
    uploadOrCaptureInvoice: 'Upload invoice or capture',

    // UnitDetails - English
    backToUnits_en: 'Back to Units', unitLabel_en: 'Unit',
    noTenant: 'No Tenant', annualRentLabel: 'Annual Rent',
    contractStartLabel: 'Contract Start', contractEndLabel: 'Contract End',
    ownerPhoneLabel: 'Owner Phone', paymentPlanLabel: 'Payment Plan',
    notesLabel: 'Notes', totalCollectedLabel: 'Total Collected',
    paymentCountLabel: 'Payment Count', lastPayment: 'Last Payment',
    paymentRecord: 'Payment Record', fromLabel: 'From', toLabel: 'To',
    periodTotal: 'Total collected in this period', noPaymentsUnit: 'No payments for this unit',
    noMatchingResults: 'No matching results', unitNotFound: 'Unit not found',

    // Access error - English
    accessRestricted_en: 'Access Restricted',
    notRegistered_en: 'You are not registered to use this application. Please contact the app administrator.',
    ifError_en: 'If you believe this is an error, you can:',
    checkAccount_en: 'Verify you are logged in with the correct account',
    contactAdmin_en: 'Contact the app administrator for access',
    tryLogout_en: 'Try logging out and back in again',
  },

  en: {
    // Navigation
    dashboard: 'Dashboard', units: 'Units', payments: 'Payments',
    expenses: 'Expenses', reports: 'Reports', savings: 'Savings',
    dataEntry: 'Data Entry', investors: 'Investors', logout: 'Logout',

    // Dashboard
    dashboardTitle: 'Dashboard', dashboardSubTitle: 'Overview of property performance',
    netIncome: 'Net Income', totalCollected: 'Total Collected',
    totalExpenses: 'Total Expenses', occupancyRate: 'Occupancy Rate',
    filterBy: 'Filter by', lastMonth: 'Last Month', last3Months: 'Last 3 Months',
    last6Months: 'Last 6 Months', lastYear: 'Last Year', allTime: 'All Time',
    monthlyRevenue: 'Monthly Revenue', upcomingExpirations: 'Upcoming Contract Expirations',
    contractEnding: 'contracts ending', days: 'days', viewDetails: 'View Details',
    recentPayments: 'Recent Payments', noRecentPayments: 'No recent payments',
    tenant: 'Tenant', amount: 'Amount', date: 'Date', status: 'Status',
    paid: 'Paid', pending: 'Pending', late: 'Late',

    // Units
    unitsTitle: 'Property Units', addUnit: 'Add Unit',
    searchUnits: 'Search by unit number or tenant name...',
    totalUnits: 'Total Units', occupiedUnits: 'Occupied',
    vacantUnits: 'Vacant', maintenanceUnits: 'Under Maintenance',
    unitNumber: 'Unit Number', tenantName: 'Tenant Name',
    contractStatus: 'Contract Status', annualRent: 'Annual Rent',
    editUnit: 'Edit Unit', deleteUnit: 'Delete Unit',
    unitDetails: 'Unit Details', floor: 'Floor',
    nationality: 'Nationality', insurance: 'Insurance',
    contractImage: 'Contract Image', uploadContract: 'Upload Contract',
    unitAdded: 'Unit added successfully', unitUpdated: 'Unit updated',
    unitDeleted: 'Unit deleted', expired: 'Expired',
    noUnitsFound: 'No units found', edit: 'Edit', delete: 'Delete',
    ownerPhone: 'Owner Phone', contractStart: 'Contract Start',
    contractEndDate: 'Contract End', paymentPlan: 'Payment Plan',
    notes: 'Notes', status: 'Status', occupied: 'Occupied',
    vacant: 'Vacant', maintenance: 'Maintenance', allStatuses: 'All Statuses',
    uploading: 'Uploading...', viewContract: 'View Contract',
    saving_: 'Saving...', save: 'Save', cancel: 'Cancel', addNewUnit: 'Add New Unit',

    // Payments
    paymentsTitle: 'Payment Ledger', registerPayment: 'Register Payment',
    searchPayments: 'Search by tenant name or unit number...',
    totalShown: 'Total Amount Shown', paymentCount: 'Payment Count',
    dueMonth: 'Due Month', paymentMethod: 'Payment Method',
    receiptNumber: 'Receipt No.', receiptImage: 'Receipt Image (Optional)',
    uploadReceipt: 'Upload Receipt', editPayment: 'Edit Payment',
    addPayment: 'Register New Payment', savePayment: 'Save Payment',
    noPayments: 'No payments', deletePaymentConfirm: 'Are you sure you want to delete this payment?',
    paymentUpdated: 'Payment updated', paymentAdded: 'Payment added successfully ✓',
    paymentDeleted: 'Payment deleted', noneUnit: '— None —',
    allStatuses_pay: 'All Statuses', amountAED: 'Amount (AED) *',

    // Expenses
    expensesTitle: 'Expenses & Costs', addExpense: 'Add Expense',
    searchExpenses: 'Search by description or vendor...', totalExpensesShown: 'Total Expenses Shown',
    expenseCount: 'Expense Count', category: 'Category', vendor: 'Vendor',
    invoiceNumber: 'Invoice No.', invoiceImage: 'Invoice Image',
    uploadInvoice: 'Upload Invoice', editExpense: 'Edit Expense',
    addNewExpense: 'Add New Expense', saveExpense: 'Save Expense',
    expenseDetails: 'Expense Details *', noExpenses: 'No expenses',
    deleteExpenseConfirm: 'Are you sure you want to delete this expense?',
    expenseUpdated: 'Expense updated', expenseAdded: 'Expense added successfully',
    expenseDeleted: 'Expense deleted', allCategories: 'All Categories',
    optionalUnit: 'Unit No. (Optional)',

    // Reports
    reportsTitle: 'Financial Reports', reportsSubTitle: 'Comprehensive financial analysis of the real estate portfolio',
    totalRevenue: 'Total Revenue', totalExpensesR: 'Total Expenses',
    netProfit: 'Net Profit', profitMargin: 'Profit Margin',
    monthlyRevenueVsExpenses: 'Monthly Revenue vs Expenses',
    noDataForYear: 'No data for this year', monthlyNetProfit: 'Monthly Net Profit',
    expenseByCategory: 'Expense Breakdown by Category', noExpenseData: 'No expenses',
    monthlyFinancialSummary: 'Monthly Financial Summary', month: 'Month',
    revenue: 'Revenue', net: 'Net', margin: 'Profit Margin', totalRow: 'Total',
    monthlyNetProfitSub: 'Monthly Net Profit', expenseCategorySub: 'Expense Breakdown by Category',

    // Investors
    investorsTitle: 'Investors', filterByDate: 'Filter by Date',
    totalRevenueI: 'Total Revenue', totalExpensesI: 'Total Expenses',
    netProfitI: 'Net Profit', clickForDetails: 'Click for details',
    revenueDetails: 'Revenue Details', expensesDetails: 'Expenses Details',
    profitSummary: 'Net Profit Summary', investorShares: 'Investor Shares',
    totalShares: 'Total Shares', investorName: 'Investor', sharePct: 'Share %',
    revShare: 'Revenue Share', expShare: 'Expense Share', netShare: 'Net Share',
    totalRow_i: 'Total', noPaymentsPeriod: 'No payments in this period',
    noExpensesPeriod: 'No expenses in this period',
    description_col: 'Description', subTotal: 'Total',
    year: 'Year', selectYear: 'Select Year',

    // Savings
    savingsTitle: 'Savings', savingsSubTitle: 'Amounts saved in deposit',
    addSaving: 'Add Saving', totalSavings: 'Total Savings in Deposit',
    savingsRecord: 'Savings Record', noSavings: 'No savings yet',
    addSavingTitle: 'Add Saving Amount', savingsDescription: 'Description *',
    savingsAmount: 'Amount *', savingsDate: 'Date *', savingAdded: 'Added successfully',
    savingDeleted: 'Deleted successfully', confirmDeleteSaving: 'Delete this saving amount?',
    fillRequired: 'Please fill all required fields',

    // DataEntry
    dataEntryTitle: 'Data Entry', registerPaymentTab: 'Register Payment',
    addExpenseTab: 'Add Expense', fullName: 'Full Name',
    savePaymentDE: 'Save Payment', saveExpenseDE: 'Save Expense',
    paymentSavedSuccess: 'Payment saved successfully!', expenseSavedSuccess: 'Expense saved successfully!',
    dueMonths: 'Due Months', uploadOrCapture: 'Upload receipt or capture',
    uploadOrCaptureInvoice: 'Upload invoice or capture',

    // UnitDetails
    backToUnits: 'Back to Units', unitLabel: 'Unit',
    noTenant: 'No Tenant', annualRentLabel: 'Annual Rent',
    contractStartLabel: 'Contract Start', contractEndLabel: 'Contract End',
    ownerPhoneLabel: 'Owner Phone', paymentPlanLabel: 'Payment Plan',
    notesLabel: 'Notes', totalCollectedLabel: 'Total Collected',
    paymentCountLabel: 'Payment Count', lastPayment: 'Last Payment',
    paymentRecord: 'Payment Record', fromLabel: 'From', toLabel: 'To',
    periodTotal: 'Total collected in this period', noPaymentsUnit: 'No payments for this unit',
    noMatchingResults: 'No matching results', unitNotFound: 'Unit not found',
    receiptName: 'Receipt Name',

    // Access error
    accessRestricted: 'Access Restricted',
    notRegistered: 'You are not registered to use this application. Please contact the app administrator.',
    ifError: 'If you believe this is an error, you can:',
    checkAccount: 'Verify you are logged in with the correct account',
    contactAdmin: 'Contact the app administrator for access',
    tryLogout: 'Try logging out and back in again',
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('app_lang') || 'ar';
    document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = saved;
    return saved;
  });

  const setLang = (newLang) => {
    localStorage.setItem('app_lang', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
    setLangState(newLang);
  };

  const t = (key) => {
    // Try direct key first
    const direct = t_data[lang]?.[key];
    if (direct) return direct;
    
    // Fallback to _en suffix version for Arabic
    if (lang === 'ar') {
      const enKey = `${key}_en`;
      const enValue = t_data.ar?.[enKey];
      if (enValue) return enValue;
    }
    
    // Final fallback to key itself
    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
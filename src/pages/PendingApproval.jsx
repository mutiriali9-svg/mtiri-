export default function PendingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0E1A30' }}>
      <div className="text-center space-y-4">
        <span className="text-5xl font-bold" style={{ color: '#C9A84C', fontFamily: 'Cairo' }}>المطيري</span>
        <div className="bg-white rounded-2xl p-8 max-w-sm space-y-3">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: 'rgba(201,168,76,0.1)' }}>
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-xl font-bold" style={{ color: '#1B2B4B' }}>طلبك قيد المراجعة</h2>
          <p className="text-sm text-muted-foreground">سيتم إشعارك عند الموافقة على طلبك</p>
        </div>
      </div>
    </div>
  );
}

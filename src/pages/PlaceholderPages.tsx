const PlaceholderPage = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="space-y-6">
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{subtitle}</p>
    </div>
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <p>Halaman ini akan segera tersedia.</p>
    </div>
  </div>
);

export const PanitiaPage = () => <PlaceholderPage title="Panitia" subtitle="Manajemen data panitia qurban" />;
export const KeuanganPage = () => <PlaceholderPage title="Keuangan" subtitle="Buku kas & laporan keuangan" />;

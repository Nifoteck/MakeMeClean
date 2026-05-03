import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/lib/supabase";
import { Image as ImageIcon, Download } from "lucide-react";

interface BookingPhoto {
  id: string;
  booking_id: string;
  storage_path: string;
  uploaded_at: string;
  booking?: { service_name: string; date: string };
}

export default function AdminPhotos() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);

  const [photos, setPhotos] = useState<BookingPhoto[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !roleLoading && isAdmin) {
      supabase
        .from("booking_photos")
        .select(`
          id,
          booking_id,
          storage_path,
          uploaded_at,
          booking:booking_id (service_name, date)
        `)
        .order("uploaded_at", { ascending: false })
        .then(({ data }) => {
          const photos = (data ?? []).map((p: any) => ({
            ...p,
            booking: Array.isArray(p.booking) ? p.booking[0] : p.booking
          }));
          setPhotos(photos as BookingPhoto[]);
          setFetching(false);
        });
    }
  }, [loading, roleLoading, isAdmin]);

  if (loading || roleLoading) return null;
  if (!user || !isAdmin) return <div className="min-h-screen flex items-center justify-center text-gray-500">Access denied</div>;

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("booking-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <AdminLayout
      title="Booking Photos"
      subtitle="Gallery of customer-uploaded booking photos"
    >
      {fetching ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center shadow-sm">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">No photos yet. Customers will see an upload option after their booking.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <img
                src={getPhotoUrl(photo.storage_path)}
                alt="Booking"
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {photo.booking?.service_name}
                </p>
                <p className="text-sm text-gray-600 mt-1">{photo.booking?.date}</p>
                <a
                  href={getPhotoUrl(photo.storage_path)}
                  download
                  className="inline-flex items-center gap-2 mt-3 text-xs font-semibold text-green-600 hover:text-green-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { User, Phone, MapPin, Mail, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { walesCities } from "@/lib/services";

interface Profile {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
}

export default function Profile() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", address: "", city: "", postcode: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "", address: data.address ?? "", city: data.city ?? "", postcode: data.postcode ?? "" });
        setFetchingProfile(false);
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").upsert({ id: user.id, ...profile });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading || fetchingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1">Manage your personal details and address.</p>
        </div>

        {/* Avatar */}
        <div className="card mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center shadow">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{profile.full_name || "Your Name"}</p>
            <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {user?.email}
            </div>
          </div>
        </div>

        <div className="card">
          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
              <Save className="w-4 h-4" /> Profile saved successfully!
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="label flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Full Name</label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Jane Smith"
                className="input-field"
                data-testid="input-fullname"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone Number</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+44 7700 000000"
                className="input-field"
                data-testid="input-phone"
              />
            </div>
            <hr className="border-gray-100" />
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Address Details</p>
            <div>
              <label className="label">Street Address</label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="12 High Street"
                className="input-field"
                data-testid="input-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <select
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  className="input-field"
                  data-testid="select-city"
                >
                  <option value="">Select city</option>
                  {walesCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Postcode</label>
                <input
                  type="text"
                  value={profile.postcode}
                  onChange={(e) => setProfile({ ...profile, postcode: e.target.value.toUpperCase() })}
                  placeholder="CF10 1AB"
                  className="input-field"
                  data-testid="input-postcode"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="button-save-profile"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

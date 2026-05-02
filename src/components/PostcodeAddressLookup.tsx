import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { lookupAddressesByPostcode, type PostcodeLookupAddress } from "@/lib/postcodeLookup";

type Props = {
  postcode: string;
  onPostcodeChange: (value: string) => void;
  onSelect: (selected: PostcodeLookupAddress) => void;
  disabled?: boolean;
};

export default function PostcodeAddressLookup({ postcode, onPostcodeChange, onSelect, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<PostcodeLookupAddress[]>([]);
  const [selectedLabel, setSelectedLabel] = useState("");

  const canSearch = useMemo(() => (postcode ?? "").trim().length >= 5, [postcode]);

  const runLookup = async () => {
    setError("");
    setSelectedLabel("");
    setOptions([]);
    if (!canSearch) return;

    try {
      setLoading(true);
      const res = await lookupAddressesByPostcode(postcode);
      setOptions(res);
      if (res.length === 0) setError("No addresses found for that postcode.");
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="label">Postcode</label>
          <input
            type="text"
            value={postcode}
            onChange={(e) => onPostcodeChange(e.target.value.toUpperCase())}
            placeholder="CF10 1AB"
            className="input-field"
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          onClick={runLookup}
          disabled={disabled || loading || !canSearch}
          className="btn-secondary h-[42px] px-4 flex items-center gap-2 disabled:opacity-60"
          aria-label="Find address by postcode"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Find
        </button>
      </div>

      {options.length > 0 && (
        <div>
          <label className="label flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Select address
          </label>
          <select
            className="input-field"
            value={selectedLabel}
            onChange={(e) => {
              const label = e.target.value;
              setSelectedLabel(label);
              const chosen = options.find((o) => o.label === label);
              if (chosen) onSelect(chosen);
            }}
            disabled={disabled}
          >
            <option value="">Choose an address</option>
            {options.map((o) => (
              <option key={o.label} value={o.label}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}


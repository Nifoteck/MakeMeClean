import { supabase } from "@/lib/supabase";

export type PostcodeLookupAddress = {
  label: string;
  address: string;
  city?: string | null;
  postcode: string;
};

export async function lookupAddressesByPostcode(postcodeRaw: string): Promise<PostcodeLookupAddress[]> {
  const postcode = (postcodeRaw ?? "").trim().toUpperCase();
  if (!postcode) return [];

  const { data, error } = await supabase.functions.invoke("postcode-lookup", {
    body: { postcode },
  });

  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "Postcode lookup failed");

  const addresses = (data.addresses ?? []) as PostcodeLookupAddress[];
  return addresses;
}


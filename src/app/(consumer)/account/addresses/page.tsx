"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Edit2,
  Home,
  MapPin,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FeedbackState } from "@/components/states/FeedbackState";
import { getSavedAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress } from "@/services/account";
import type { Address, AddressType } from "@/types/address";

interface AddressFormState {
  name: string;
  type: AddressType;
  street: string;
  area: string;
  city: string;
  phone: string;
  isDefault: boolean;
}

const emptyAddressForm: AddressFormState = {
  name: "",
  type: "Home",
  street: "",
  area: "",
  city: "Lusaka",
  phone: "",
  isDefault: false,
};

export default function AddressesPage() {
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingAddressId, setEditingAddressId] = React.useState<string | null>(null);
  const [addressForm, setAddressForm] = React.useState<AddressFormState>(emptyAddressForm);

  const loadAddresses = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSavedAddresses();
      setAddresses(data);
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && err.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load addresses.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleDelete = async (id: string) => {
    try {
      setSavingId(id);
      await deleteAddress(id);
      await loadAddresses();
    } catch (err) {
      console.error(err);
      setError("Failed to delete address.");
    } finally {
      setSavingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      setSavingId(id);
      await setDefaultAddress(id);
      setAddresses(addresses.map((address) => ({
        ...address,
        isDefault: address.id === id,
      })));
    } catch (err) {
      console.error(err);
      setError("Failed to set default address.");
    } finally {
      setSavingId(null);
    }
  };

  const openCreateDialog = () => {
    setEditingAddressId(null);
    setAddressForm({ ...emptyAddressForm, isDefault: addresses.length === 0 });
    setDialogOpen(true);
  };

  const openEditDialog = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      name: address.name,
      type: address.type,
      street: address.street,
      area: address.area,
      city: address.city,
      phone: address.phone,
      isDefault: address.isDefault,
    });
    setDialogOpen(true);
  };

  const updateAddressForm = (field: keyof AddressFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const value = field === "isDefault" && event.target instanceof HTMLInputElement
      ? event.target.checked
      : event.target.value;
    setAddressForm((current) => ({ ...current, [field]: value }));
  };

  const formIsValid = Boolean(
    addressForm.name.trim() &&
      addressForm.street.trim() &&
      addressForm.area.trim() &&
      addressForm.city.trim() &&
      addressForm.phone.trim(),
  );

  const handleSaveAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formIsValid) return;

    try {
      setSavingId(editingAddressId ?? "new");
      if (editingAddressId) {
        const updated = await updateAddress({
          id: editingAddressId,
          name: addressForm.name.trim(),
          type: addressForm.type,
          street: addressForm.street.trim(),
          area: addressForm.area.trim(),
          city: addressForm.city.trim(),
          phone: addressForm.phone.trim(),
          isDefault: addressForm.isDefault,
        });
        setAddresses(addresses.map(a => a.id === editingAddressId ? updated : (updated.isDefault ? { ...a, isDefault: false } : a)));
      } else {
        const created = await createAddress({
          name: addressForm.name.trim(),
          type: addressForm.type,
          street: addressForm.street.trim(),
          area: addressForm.area.trim(),
          city: addressForm.city.trim(),
          phone: addressForm.phone.trim(),
          isDefault: addressForm.isDefault || addresses.length === 0,
        });
        setAddresses(created.isDefault 
          ? [...addresses.map(a => ({ ...a, isDefault: false })), created]
          : [...addresses, created]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save address.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
            Saved Addresses
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Manage where your Zogular orders are delivered.
          </p>
        </div>

        {!loading && !error && (
          <Button onClick={openCreateDialog} className="flex h-11 items-center gap-2 rounded-xl bg-[#009E49] px-5 font-bold text-white shadow-md shadow-[#009E49]/20 hover:bg-[#00853d]">
            <Plus className="h-4 w-4" />
            Add New Address
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm font-medium text-zinc-500">
          Loading addresses...
        </div>
      ) : error ? (
        <FeedbackState
          icon={AlertCircle}
          tone="danger"
          title="Failed to load addresses"
          description={error}
          action={
            error === "Your session expired. Please sign in again." ? (
              <Link href="/auth/login?next=/account/addresses">
                <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
                  Sign In
                </Button>
              </Link>
            ) : (
              <Button onClick={loadAddresses} variant="outline" className="border-red-200 text-red-700 hover:bg-red-100">
                Try Again
              </Button>
            )
          }
        />
      ) : addresses.length === 0 ? (
        <FeedbackState
          icon={MapPin}
          title="No saved addresses"
          description="Add your first delivery address to get started."
          action={
            <Button onClick={openCreateDialog} className="bg-zinc-900 text-white hover:bg-zinc-800">
              Add Address
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2 md:gap-6">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`relative flex h-full flex-col rounded-3xl border p-6 transition-all duration-300 hover:shadow-md ${
                address.isDefault
                  ? "border-[#009E49]/30 ring-1 ring-[#009E49]/10 shadow-[0_4px_20px_rgba(0,158,73,0.05)]"
                  : "border-zinc-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] bg-white"
              }`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    address.isDefault ? "bg-[#009E49]/10 text-[#009E49]" : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {address.type === "Home" ? <Home className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                  </div>

                  <div>
                    <h3 className="font-bold text-zinc-900">{address.type}</h3>

                    {address.isDefault ? (
                      <Badge className="mt-0.5 flex h-5 items-center gap-1 border-none bg-[#009E49]/10 px-2 py-0 text-[10px] text-[#009E49] shadow-none">
                        <CheckCircle2 className="h-3 w-3" />
                        Default
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mb-6 flex-1 space-y-1.5">
                <p className="text-sm font-bold text-zinc-900">{address.name}</p>

                <div className="flex items-start gap-2 text-sm text-zinc-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <span>
                    {address.street}
                    <br />
                    {address.area}, {address.city}
                  </span>
                </div>

                <p className="pt-1 text-sm font-medium text-zinc-500">{address.phone}</p>
              </div>

              <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-4">
                <Button
                  variant="outline"
                  onClick={() => openEditDialog(address)}
                  className="h-9 flex-1 rounded-xl border-zinc-200 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
                >
                  <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>

                {!address.isDefault ? (
                  <Button
                    variant="ghost"
                    onClick={() => void handleSetDefault(address.id)}
                    disabled={savingId === address.id}
                    className="h-9 px-3 text-xs font-bold text-[#009E49] hover:bg-[#009E49]/10"
                  >
                    {savingId === address.id ? "Saving..." : "Set Default"}
                  </Button>
                ) : null}

                <Button
                  variant="ghost"
                  onClick={() => void handleDelete(address.id)}
                  disabled={savingId === address.id}
                  title="Delete address"
                  className="h-9 w-9 rounded-xl p-0 transition-colors text-zinc-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-3xl border-zinc-200 bg-white p-0 sm:max-w-lg">
          <form onSubmit={handleSaveAddress} className="space-y-5 p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-zinc-900">
                {editingAddressId ? "Edit Address" : "Add Address"}
              </DialogTitle>
              <DialogDescription>
                Save delivery details for faster Zogular checkout.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Recipient Name</span>
                <Input value={addressForm.name} onChange={updateAddressForm("name")} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 focus-visible:ring-[#009E49]" required />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Type</span>
                <select aria-label="Address type" value={addressForm.type} onChange={updateAddressForm("type")} className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#009E49]">
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Phone</span>
                <Input value={addressForm.phone} onChange={updateAddressForm("phone")} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 focus-visible:ring-[#009E49]" required />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Street Address <span className="text-[10px] font-normal lowercase opacity-70">(include landmarks if any)</span>
                </span>
                <Input value={addressForm.street} onChange={updateAddressForm("street")} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 focus-visible:ring-[#009E49]" required />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Area</span>
                <Input value={addressForm.area} onChange={updateAddressForm("area")} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 focus-visible:ring-[#009E49]" required />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">City</span>
                <Input value={addressForm.city} onChange={updateAddressForm("city")} className="h-11 rounded-xl border-zinc-200 bg-zinc-50 focus-visible:ring-[#009E49]" required />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className={`flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-700 ${
                editingAddressId && addresses.find(a => a.id === editingAddressId)?.isDefault ? "cursor-not-allowed opacity-70" : ""
              }`}>
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={updateAddressForm("isDefault")}
                  disabled={Boolean(editingAddressId && addresses.find(a => a.id === editingAddressId)?.isDefault)}
                  className="h-4 w-4 accent-[#009E49] disabled:cursor-not-allowed"
                />
                Make this my default delivery address
              </label>
              {editingAddressId && addresses.find(a => a.id === editingAddressId)?.isDefault ? (
                <p className="px-1 text-xs font-medium text-zinc-500">
                  Choose another address as default before changing this.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-zinc-200 font-bold">
                Cancel
              </Button>
              <Button disabled={!formIsValid || savingId !== null} className="rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d] disabled:opacity-60">
                {savingId !== null ? "Saving..." : "Save Address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

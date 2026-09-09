import React, { useState } from 'react';
import { Building2, Plus, Phone, Mail, MapPin, DollarSign, Edit, Check, X } from 'lucide-react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Supplier } from '../../types/pharmacy';
import { DesktopWindow } from '../common/DesktopWindow';
import { SectionRestoreButton } from '../common/SectionRestoreButton';

export const SupplierView: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, formatLBP, formatUSD } = usePharmacy();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net');
  const [balanceUSD, setBalanceUSD] = useState('0');

  const openAddModal = () => {
    setEditingSupplierId(null);
    setName('');
    setCode(`SUP-${Math.floor(100 + Math.random() * 900)}`);
    setPhone('+961 1 ');
    setEmail('');
    setAddress('Beirut, Lebanon');
    setContactPerson('');
    setPaymentTerms('30 Days Net');
    setBalanceUSD('0');
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplierId(sup.id);
    setName(sup.name);
    setCode(sup.code);
    setPhone(sup.phone);
    setEmail(sup.email);
    setAddress(sup.address);
    setContactPerson(sup.contactPerson);
    setPaymentTerms(sup.paymentTerms);
    setBalanceUSD(sup.balanceUSD.toString());
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const balUSD = parseFloat(balanceUSD) || 0;

    if (editingSupplierId) {
      updateSupplier(editingSupplierId, {
        name,
        code,
        phone,
        email,
        address,
        contactPerson,
        paymentTerms,
        balanceUSD: balUSD,
        balanceLBP: Math.round(balUSD * 89500),
      });
    } else {
      addSupplier({
        name,
        code,
        phone,
        email,
        address,
        contactPerson,
        paymentTerms,
        balanceUSD: balUSD,
        balanceLBP: Math.round(balUSD * 89500),
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 p-3.5 space-y-3 select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded border border-gray-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center space-x-2">
            <SectionRestoreButton section="supplier" />
            <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
              Suppliers & Pharmaceutical Distributors
            </h2>
            <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200 dark:bg-teal-950 dark:text-teal-300">
              {suppliers.length} Agents
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
            Lebanese drug agencies, agent directories, and pending payable balances.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center space-x-1 rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Grid of Suppliers */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              className="flex flex-col justify-between rounded border border-gray-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 hover:border-teal-400 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-900">
                    {sup.code}
                  </span>
                  <button
                    onClick={() => openEditModal(sup)}
                    className="p-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                </div>

                <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {sup.name}
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-slate-400">
                  Contact: {sup.contactPerson || 'Sales Dept'}
                </p>

                <div className="mt-2.5 space-y-1 text-xs text-gray-600 dark:text-slate-300">
                  <div className="flex items-center space-x-1.5">
                    <Phone className="h-3 w-3 text-gray-400" />
                    <span className="text-[11px]">{sup.phone}</span>
                  </div>
                  {sup.email && (
                    <div className="flex items-center space-x-1.5">
                      <Mail className="h-3 w-3 text-gray-400" />
                      <span className="text-[11px]">{sup.email}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <span className="text-[11px] truncate">{sup.address}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-gray-400">Balance Owed</span>
                  <span className={`font-bold ${sup.balanceUSD > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    ${sup.balanceUSD.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-semibold text-gray-400">Terms</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                    {sup.paymentTerms}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <DesktopWindow
          title={editingSupplierId ? 'Edit Supplier' : 'Register New Supplier'}
          isOpen={true}
          section="supplier"
          onClose={() => setIsModalOpen(false)}
          width="480px"
          height="auto"
        >
          <form onSubmit={handleSave} className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Supplier / Agency Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Mersaco Sal"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 uppercase font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Sales Rep"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales@example.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Office Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Sin El Fil, Beirut"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="30 Days Net"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Initial Balance ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={balanceUSD}
                    onChange={(e) => setBalanceUSD(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Discard
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition-all cursor-pointer active:scale-95"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{editingSupplierId ? 'Update Agency' : 'Register Agency'}</span>
              </button>
            </div>
          </form>
        </DesktopWindow>
      )}
    </div>
  );
};

'use client';

import { useEffect, useState } from 'react';
import { commerceApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Wallet, Gift, Users, Clock, Ticket, Copy, CheckCircle } from 'lucide-react';

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [refCopied, setRefCopied] = useState(false);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    commerceApi.wallet(token)
      .then((res) => setWallet(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleRedeem = async () => {
    if (!token || !couponCode) return;
    setRedeemMsg('');
    setRedeemError('');
    try {
      const res = await commerceApi.redeemCoupon(token, couponCode) as any;
      setRedeemMsg(`+${res.data.credits} credit(s) ajoute(s) !`);
      setCouponCode('');
      // Refresh wallet
      const w = await commerceApi.wallet(token);
      setWallet(w.data);
    } catch (err: any) {
      setRedeemError(err.message);
    }
  };

  const copyRefCode = () => {
    if (wallet?.refCode) {
      navigator.clipboard.writeText(wallet.refCode);
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Mon portefeuille
      </h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Credits</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{wallet?.credits || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Gift className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Tests gratuits</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{wallet?.freeTests || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Pass illimite</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {wallet?.unlimitedUntil
              ? `Jusqu'au ${new Date(wallet.unlimitedUntil).toLocaleDateString('fr-FR')}`
              : 'Inactif'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coupon redemption */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5" /> Utiliser un code
          </h2>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="BON-XXXX-XXXX"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
            />
            <button
              onClick={handleRedeem}
              disabled={!couponCode}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Activer
            </button>
          </div>
          {redeemMsg && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> {redeemMsg}
            </p>
          )}
          {redeemError && <p className="text-sm text-red-500">{redeemError}</p>}
        </div>

        {/* Referral */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" /> Parrainage
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Partagez votre code et gagnez des credits quand vos filleuls effectuent leur premier achat.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-center font-mono font-bold text-lg text-gray-900 dark:text-white">
              {wallet?.refCode || '---'}
            </code>
            <button onClick={copyRefCode} className="p-2 text-gray-500 hover:text-gray-700" title="Copier">
              {refCopied ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-sm text-gray-500">
            {wallet?.referralCount || 0} filleul(s)
            {wallet?.referralRewarded && ' (bonus deja recu)'}
          </p>
        </div>
      </div>

      {/* Vouchers */}
      {wallet?.vouchers && wallet.vouchers.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
            Mes bons d'acces
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {wallet.vouchers.map((v: any) => (
              <div key={v.code} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <code className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{v.code}</code>
                <p className="text-xs text-gray-500 mt-1">
                  {v.used_count}/{v.max_uses} utilisation(s)
                  {v.expires_at && ` — expire le ${new Date(v.expires_at).toLocaleDateString('fr-FR')}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

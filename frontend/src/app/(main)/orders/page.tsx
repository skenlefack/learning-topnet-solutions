'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { commerceApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'En attente', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
  awaiting: { label: 'Verification en cours', color: 'text-orange-600 bg-orange-50', icon: AlertCircle },
  processing: { label: 'Traitement', color: 'text-blue-600 bg-blue-50', icon: Clock },
  paid: { label: 'Paye', color: 'text-green-600 bg-green-50', icon: CheckCircle },
  rejected: { label: 'Rejete', color: 'text-red-600 bg-red-50', icon: XCircle },
  canceled: { label: 'Annule', color: 'text-gray-500 bg-gray-50', icon: XCircle },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    commerceApi.orders(token)
      .then((res) => setOrders(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
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
        Mes commandes
      </h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune commande pour le moment.</p>
          <button
            onClick={() => router.push('/shop')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Voir les offres
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <div
                key={order.id}
                onClick={() => router.push(`/orders/${order.ref}`)}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {order.offer_name?.fr || order.offer_name?.en || order.ref}
                    </p>
                    <p className="text-sm text-gray-500">
                      {order.ref} &middot; {new Date(order.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatPrice(order.amount, order.currency)}
                  </span>
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

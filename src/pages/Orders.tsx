import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ShoppingBag, Package, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { OrderActions } from '@/components/order/OrderActions';
import { PaymentButton } from '@/components/order/PaymentButton';

const Orders = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      navigate('/auth');
      return;
    }
    setUser(data.user);
  };

  // ------------------- Borrowed Orders -------------------
  const { data: borrowedOrders, refetch: refetchBorrowed } = useQuery({
    queryKey: ['borrowed-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      try {
        const [itemsRes, servicesRes] = await Promise.all([
          supabase
            .from('orders')
            .select(`
              *,
              listings!inner(title, images, type),
              seller:profiles!orders_seller_id_fkey(name, avatar_url)
            `)
            .eq('buyer_id', user.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('service_orders')
            .select(`
              *,
              services:listings!service_orders_service_id_fkey(title, images, type),
              provider:profiles!service_orders_provider_id_fkey(name, avatar_url)
            `)
            .eq('buyer_id', user.id)
            .order('created_at', { ascending: false }),
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (servicesRes.error) throw servicesRes.error;

        const items = (itemsRes.data || []).map((o: any) => ({
          ...o,
          type: 'item',
          listing: o.listings,
          otherUser: o.seller,
        }));

        const services = (servicesRes.data || []).map((o: any) => ({
          ...o,
          type: 'service',
          listing: o.services,
          otherUser: o.provider,
        }));

        return [...items, ...services];
      } catch (err) {
        console.error('Borrowed orders fetch failed:', err);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // ------------------- Lent Orders -------------------
  const { data: lentOrders, refetch: refetchLent } = useQuery({
    queryKey: ['lent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      try {
        const [itemsRes, servicesRes] = await Promise.all([
          supabase
            .from('orders')
            .select(`
              *,
              listings!inner(title, images, type),
              buyer:profiles!orders_buyer_id_fkey(name, avatar_url)
            `)
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('service_orders')
            .select(`
              *,
              services:listings!service_orders_service_id_fkey(title, images, type),
              buyer:profiles!service_orders_buyer_id_fkey(name, avatar_url)
            `)
            .eq('provider_id', user.id)
            .order('created_at', { ascending: false }),
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (servicesRes.error) throw servicesRes.error;

        const items = (itemsRes.data || []).map((o: any) => ({
          ...o,
          type: 'item',
          listing: o.listings,
          otherUser: o.buyer,
        }));

        const services = (servicesRes.data || []).map((o: any) => ({
          ...o,
          type: 'service',
          listing: o.services,
          otherUser: o.buyer,
        }));

        return [...items, ...services];
      } catch (err) {
        console.error('Lent orders fetch failed:', err);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'accepted':
        return 'secondary';
      case 'paid':
        return 'default';
      case 'active':
        return 'default';
      case 'completed':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const handleOrderUpdate = () => {
    refetchBorrowed();
    refetchLent();
  };

  // ------------------- Order Card -------------------
  const OrderCard = ({
    order,
    viewType,
  }: {
    order: any;
    viewType: 'borrowed' | 'lent';
  }) => {
    const isOwner = viewType === 'lent';
    const canAcceptDeny = isOwner && order.status === 'pending';
    const canPay = !isOwner && order.status === 'accepted';
    const canChat = ['accepted', 'paid', 'active', 'completed'].includes(
      order.status
    );

    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {order.listing?.title || 'Untitled'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {viewType === 'borrowed'
                  ? `From: ${order.otherUser?.name || 'Unknown'}`
                  : `To: ${order.otherUser?.name || 'Unknown'}`}
              </p>
            </div>
            <Badge variant={getStatusColor(order.status)}>
              {order.status}
            </Badge>
          </div>

          {order.listing?.images?.[0] && (
            <img
              src={order.listing.images[0]}
              alt={order.listing.title}
              className="w-full h-32 object-cover rounded-lg"
            />
          )}

          <div className="space-y-2 text-sm">
            {order.final_amount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">
                  ${Number(order.final_amount).toFixed(2)}
                </span>
              </div>
            )}
            {order.quantity && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity:</span>
                <span>{order.quantity}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ordered:</span>
              <span>
                {formatDistanceToNow(new Date(order.created_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>

          {order.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1">Notes:</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {canAcceptDeny && (
              <OrderActions
                orderId={order.id}
                orderType={order.type}
                onActionComplete={handleOrderUpdate}
              />
            )}

            {canPay && (
              <PaymentButton
                orderId={order.id}
                orderType={order.type}
                amount={Number(order.final_amount)}
              />
            )}

            {canChat && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/chat?order=${order.id}`)}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Message
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ------------------- Render -------------------
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-primary px-6 py-6 text-white">
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-white/90">Track your orders and requests</p>
        </div>

        {/* Create Listing Buttons */}
        <div className="px-6 flex gap-4">
          <Link to="/create-listing">
            <Button>Create Item Listing</Button>
          </Link>
          <Link to="/create-service">
            <Button variant="outline">Offer a Service</Button>
          </Link>
        </div>

        {/* Orders Tabs */}
        <div className="px-6">
          <Tabs defaultValue="borrowed" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="borrowed">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Borrowed ({borrowedOrders?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="lent">
                <Package className="h-4 w-4 mr-2" />
                Received ({lentOrders?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="borrowed" className="space-y-4 mt-4">
              {borrowedOrders?.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {borrowedOrders.map((order: any) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      viewType="borrowed"
                    />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No orders yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Browse listings to get started
                    </p>
                    <Link to="/home">
                      <Button>Browse Listings</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="lent" className="space-y-4 mt-4">
              {lentOrders?.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {lentOrders.map((order: any) => (
                    <OrderCard key={order.id} order={order} viewType="lent" />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No incoming orders yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Create listings to receive orders
                    </p>
                    <Link to="/add">
                      <Button>Create Listing</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Orders;

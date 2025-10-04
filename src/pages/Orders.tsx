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
            .order('created_at', { ascending: false })
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (servicesRes.error) throw servicesRes.error;

        const items = (itemsRes.data || []).map((o: any) => ({
          ...o,
          type: 'item',
          listing: o.listings,
          otherUser: o.seller
        }));

        const services = (servicesRes.data || []).map((o: any) => ({
          ...o,
          type: 'service',
          listing: o.services,
          otherUser: o.provider
        }));

        return [...items, ...services];
      } catch (err) {
        console.error('Borrowed orders fetch failed:', err);
        return [];
      }
    },
    enabled: !!user?.id
  });

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
            .order('created_at', { ascending: false })
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (servicesRes.error) throw servicesRes.error;

        const items = (itemsRes.data || []).map((o: any) => ({
          ...o,
          type: 'item',
          listing: o.listings,
          otherUser: o.buyer
        }));

        const services = (servicesRes.data || []).map((o: any) => ({
          ...o,
          type: 'service',
          listing: o.services,
          otherUser: o.buyer
        }));

        return [...items, ...services];
      } catch (err) {
        console.error('Lent orders fetch failed:', err);
        return [];
      }
    },
    enabled: !!user?.id
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'secondary';
      case 'paid': return 'default';
      case 'active': return 'default';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  const handleOrderUpdate = () => {
    refetchBorrowed();
    refetchLent();
  };

  const OrderCard = ({ order, viewType }: { order: any, viewType: 'borrowed' | 'lent' }) => {
    const isOwner = viewType === 'lent';
    const canAcceptDeny = isOwner && order.status === 'pending';
    const canPay = !isOwner && order.status === 'accepted';
    const canChat = ['accepted', 'paid', 'active', 'completed'].includes(order.status);

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
                  : `To: ${order.otherUser?.name || 'Unknown'}`
                }
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
                <span className="font-medium">${Number(order.final_amount).toFixed(2)}</span>
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
              <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</span>
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="bg-gradient-primary px-6 py-6 text-white">
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-white/90">Track your orders and requests</p>
        </div>

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
                    <OrderCard key={order.id} order={order} viewType="borrowed" />
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No orders yet</h3>
                    <p className="text-muted-foreground mb-4">Browse listings to get started</p>
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
                    <h3 className="text-lg font-medium mb-2">No incoming orders yet</h3>
                    <p className="text-muted-foreground mb-4">Create listings to receive orders</p>
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

export default Orders;          .from('service_orders')
          .select('*, services(title, images), provider:profiles(name)')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false });

        if (servicesRes.error) throw servicesRes.error;
        const servicesData = servicesRes.data ?? [];

        // unify data format
        const formattedItems = itemsData.map(o => ({ ...o, type: 'item', profiles: o.seller }));
        const formattedServices = servicesData.map(o => ({ ...o, type: 'service', profiles: o.provider }));

        return [...formattedItems, ...formattedServices];
      } catch (err) {
        console.error('Borrowed orders fetch failed:', err);
        return [];
      }
    },
    enabled: !!user?.id
  });

  // ------------------------
  // Fetch lent orders
  // ------------------------
  const { data: lentOrders } = useQuery({
    queryKey: ['lent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      try {
        // Lent items
        const itemsRes = await supabase
          .from('orders')
          .select('*, listings(title, images), buyer:profiles(name)')
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false });

        if (itemsRes.error) throw itemsRes.error;
        const itemsData = itemsRes.data ?? [];

        // Lent services
        const servicesRes = await supabase
          .from('service_orders')
          .select('*, services(title, images), buyer:profiles(name)')
          .eq('provider_id', user.id)
          .order('created_at', { ascending: false });

        if (servicesRes.error) throw servicesRes.error;
        const servicesData = servicesRes.data ?? [];

        // unify data format
        const formattedItems = itemsData.map(o => ({ ...o, type: 'item', profiles: o.buyer }));
        const formattedServices = servicesData.map(o => ({ ...o, type: 'service', profiles: o.buyer }));

        return [...formattedItems, ...formattedServices];
      } catch (err) {
        console.error('Lent orders fetch failed:', err);
        return [];
      }
    },
    enabled: !!user?.id
  });

  // ------------------------
  // Status color helper
  // ------------------------
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'secondary';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  // ------------------------
  // Order card
  // ------------------------
  const OrderCard = ({ order, type }: { order: any, type: 'borrowed' | 'lent' }) => (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {order.listings?.title || order.services?.title || 'Untitled'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {type === 'borrowed'
                ? (order.type === 'service' ? 'Hired from' : 'Borrowed from')
                : (order.type === 'service' ? 'Service for' : 'Lent to')
              }: {order.profiles?.name || 'Unknown'}
            </p>
          </div>
          <Badge variant={getStatusColor(order.status)}>
            {order.type === 'service' ? 'Service' : 'Item'} • {order.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {order.final_amount && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">${order.final_amount}</span>
            </div>
          )}
          {order.quantity && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantity:</span>
              <span>{order.quantity}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ordered:</span>
            <span>{formatDistanceToNow(new Date(order.created_at))} ago</span>
          </div>
          {order.notes && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Notes:</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Link to={`/orders/${order.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">View Details</Button>
          </Link>
          {order.status === 'accepted' && (
            <Link to={`/messages?order=${order.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">Message</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // ------------------------
  // Render
  // ------------------------
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Track your borrowing, lending, and service activity</p>
        </div>

        <Tabs defaultValue="borrowed" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="borrowed">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Borrowed / Hired ({borrowedOrders?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="lent">
              <Package className="h-4 w-4 mr-2" />
              Lent / Provided ({lentOrders?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="borrowed" className="space-y-4">
            {borrowedOrders?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {borrowedOrders.map(order => <OrderCard key={order.id} order={order} type="borrowed" />)}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No borrowed or hired records</h3>
                  <p className="text-muted-foreground mb-4">Browse items or hire services to get started</p>
                  <div className="flex justify-center gap-4">
                    <Link to="/browse"><Button>Browse Items</Button></Link>
                    <Link to="/services"><Button variant="outline">Find Services</Button></Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="lent" className="space-y-4">
            {lentOrders?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {lentOrders.map(order => <OrderCard key={order.id} order={order} type="lent" />)}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No lending or service records</h3>
                  <p className="text-muted-foreground mb-4">Create listings or offer your skills</p>
                  <div className="flex justify-center gap-4">
                    <Link to="/create-listing"><Button>Create Item Listing</Button></Link>
                    <Link to="/create-service"><Button variant="outline">Offer a Service</Button></Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Orders;

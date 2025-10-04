import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ShoppingBag, Package, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

const Orders = () => {
  const { user } = useAuth();

  // ------------------------
  // Borrowed / Hired
  // ------------------------
  const { data: borrowedOrders } = useQuery({
    queryKey: ['borrowed-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Items
      const { data: itemsData } = await supabase
        .from('orders')
        .select('*, listings(title, images), seller:profiles(name)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      // Services
      const { data: servicesData } = await supabase
        .from('service_orders')
        .select('*, services(title, images), provider:profiles(name)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      // Format
      const formattedItems = (itemsData || []).map(o => ({ ...o, type: 'item', profiles: o.seller }));
      const formattedServices = (servicesData || []).map(o => ({
        ...o,
        type: 'service',
        profiles: o.provider
      }));

      return [...formattedItems, ...formattedServices];
    },
    enabled: !!user?.id
  });

  // ------------------------
  // Lent / Provided
  // ------------------------
  const { data: lentOrders } = useQuery({
    queryKey: ['lent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Items
      const { data: itemsData } = await supabase
        .from('orders')
        .select('*, listings(title, images), buyer:profiles(name)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      // Services
      const { data: servicesData } = await supabase
        .from('service_orders')
        .select('*, services(title, images), buyer:profiles(name)')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      // Format
      const formattedItems = (itemsData || []).map(o => ({ ...o, type: 'item', profiles: o.buyer }));
      const formattedServices = (servicesData || []).map(o => ({ ...o, type: 'service', profiles: o.buyer }));

      return [...formattedItems, ...formattedServices];
    },
    enabled: !!user?.id
  });

  // ------------------------
  // Status badge
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
              {order.listings?.title || order.services?.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {type === 'borrowed'
                ? (order.type === 'service' ? 'Hired from' : 'Borrowed from')
                : (order.type === 'service' ? 'Service for' : 'Lent to')
              }: {order.profiles?.name}
            </p>
          </div>
          <Badge variant={getStatusColor(order.status)}>
            {order.type === 'service' ? 'Service' : 'Item'} • {order.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {/* Show amount if exists */}
          {order.final_amount && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">${order.final_amount}</span>
            </div>
          )}

          {/* Only show quantity for items */}
          {order.type === 'item' && order.quantity && (
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
            <Button variant="outline" size="sm" className="w-full">
              View Details
            </Button>
          </Link>
          {order.status === 'accepted' && (
            <Link to={`/messages?order=${order.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Message
              </Button>
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
              Borrowed / Hired ({borrowedOrders?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="lent">
              <Package className="h-4 w-4 mr-2" />
              Lent / Provided ({lentOrders?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="borrowed" className="space-y-4">
            {borrowedOrders?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No borrowed or hired records</h3>
                  <p className="text-muted-foreground mb-4">
                    Browse items or hire services to get started
                  </p>
                  <div className="flex justify-center gap-4">
                    <Link to="/browse">
                      <Button>Browse Items</Button>
                    </Link>
                    <Link to="/services">
                      <Button variant="outline">Find Services</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {borrowedOrders.map(order => (
                  <OrderCard key={order.id} order={order} type="borrowed" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="lent" className="space-y-4">
            {lentOrders?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No lending or service records</h3>
                  <p className="text-muted-foreground mb-4">
                    Create listings or offer your skills
                  </p>
                  <div className="flex justify-center gap-4">
                    <Link to="/create-listing">
                      <Button>Create Item Listing</Button>
                    </Link>
                    <Link to="/create-service">
                      <Button variant="outline">Offer a Service</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {lentOrders.map(order => (
                  <OrderCard key={order.id} order={order} type="lent" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Orders;

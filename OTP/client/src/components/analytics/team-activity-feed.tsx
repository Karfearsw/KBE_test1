import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  Bell, 
  User, 
  Phone, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  RefreshCw,
  Zap
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: 'call' | 'lead' | 'conversion' | 'system' | 'user';
  title: string;
  description: string;
  timestamp: Date;
  user?: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  currentActivity?: string;
}

export function TeamActivityFeed() {
  const { connected, error } = useWebSocket() ?? { connected: false, error: null };
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filter, setFilter] = useState<'all' | 'calls' | 'leads' | 'conversions'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Simulate real-time activity updates
  useEffect(() => {
    if (!connected) return;

    const generateActivity = (): ActivityItem => {
      const types: ActivityItem['type'][] = ['call', 'lead', 'conversion', 'system', 'user'];
      const priorities: ActivityItem['priority'][] = ['low', 'medium', 'high'];
      const users = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson'];
      
      const type = types[Math.floor(Math.random() * types.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const user = users[Math.floor(Math.random() * users.length)];

      const templates = {
        call: [
          { title: "New Call Scheduled", description: `Call with lead scheduled for 2:00 PM by ${user}` },
          { title: "Call Completed", description: `Follow-up call completed successfully by ${user}` },
          { title: "Call Missed", description: `Missed call from potential client - ${user} following up` }
        ],
        lead: [
          { title: "New Lead Created", description: `New hot lead added by ${user}` },
          { title: "Lead Status Updated", description: `Lead moved to qualified by ${user}` },
          { title: "Lead Assigned", description: `Lead assigned to ${user} for follow-up` }
        ],
        conversion: [
          { title: "Deal Closed", description: `${user} closed a $50K deal` },
          { title: "Contract Signed", description: `Purchase agreement signed by client - ${user}` },
          { title: "Payment Received", description: `Commission payment processed for ${user}` }
        ],
        system: [
          { title: "System Update", description: "New features deployed successfully" },
          { title: "Performance Alert", description: "Response time improved by 15%" },
          { title: "Backup Complete", description: "Daily backup completed successfully" }
        ],
        user: [
          { title: "User Login", description: `${user} logged in from mobile device` },
          { title: "Profile Updated", description: `${user} updated their profile information` },
          { title: "Settings Changed", description: `${user} modified notification preferences` }
        ]
      };

      const templateList = templates[type];
      const template = templateList[Math.floor(Math.random() * templateList.length)];

      return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        title: template.title,
        description: template.description,
        timestamp: new Date(),
        user,
        priority,
        read: Math.random() > 0.7
      };
    };

    const interval = setInterval(() => {
      const newActivity = generateActivity();
      setActivities(prev => [newActivity, ...prev].slice(0, 50)); // Keep last 50 activities
      setLastUpdated(new Date());
    }, 3000 + Math.random() * 2000); // Random interval between 3-5 seconds

    return () => clearInterval(interval);
  }, [connected]);

  // Simulate team member status updates
  useEffect(() => {
    if (!connected) return;

    const members: TeamMember[] = [
      { id: '1', name: 'John Doe', status: 'online', lastSeen: new Date(), currentActivity: 'On a call with client' },
      { id: '2', name: 'Jane Smith', status: 'away', lastSeen: new Date(Date.now() - 5 * 60 * 1000), currentActivity: 'In meeting' },
      { id: '3', name: 'Mike Johnson', status: 'online', lastSeen: new Date(), currentActivity: 'Following up on leads' },
      { id: '4', name: 'Sarah Wilson', status: 'offline', lastSeen: new Date(Date.now() - 30 * 60 * 1000) },
      { id: '5', name: 'David Brown', status: 'online', lastSeen: new Date(), currentActivity: 'Processing new leads' }
    ];

    setTeamMembers(members);

    const interval = setInterval(() => {
      setTeamMembers(prev => prev.map(member => {
        const shouldUpdate = Math.random() > 0.8;
        if (!shouldUpdate) return member;

        const statuses: TeamMember['status'][] = ['online', 'away', 'offline'];
        const activities = [
          'On a call with client',
          'Following up on leads',
          'Processing new leads',
          'In meeting',
          'Updating client information',
          'Reviewing contracts'
        ];

        return {
          ...member,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          lastSeen: new Date(),
          currentActivity: Math.random() > 0.5 ? activities[Math.floor(Math.random() * activities.length)] : undefined
        };
      }));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [connected]);

  const getActivityIcon = (type: ActivityItem['type']) => {
    const icons = {
      call: Phone,
      lead: User,
      conversion: TrendingUp,
      system: AlertCircle,
      user: User
    };
    return icons[type];
  };

  const getPriorityColor = (priority: ActivityItem['priority']) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return colors[priority];
  };

  const getStatusColor = (status: TeamMember['status']) => {
    const colors = {
      online: 'bg-green-500',
      away: 'bg-yellow-500',
      offline: 'bg-gray-400'
    };
    return colors[status];
  };

  const filteredActivities = activities.filter(activity => {
    if (showUnreadOnly && activity.read) return false;
    if (filter === 'all') return true;
    // Map filter values to activity types
    const filterToTypeMap = {
      'calls': 'call',
      'leads': 'lead', 
      'conversions': 'conversion'
    } as const;
    return activity.type === filterToTypeMap[filter];
  });

  const unreadCount = activities.filter(a => !a.read).length;

  const markAllAsRead = () => {
    setActivities(prev => prev.map(a => ({ ...a, read: true })));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Team Activity Feed</h2>
          <p className="text-neutral-600">Real-time notifications and team collaboration</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={connected ? "default" : "secondary"}>
            <div className={`w-2 h-2 rounded-full mr-2 ${connected ? "bg-green-500" : "bg-red-500"}`} />
            {connected ? "Live" : "Offline"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Connection Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Connection Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                  className={showUnreadOnly ? "bg-blue-50 border-blue-200" : ""}
                >
                  <Bell className="h-4 w-4 mr-1" />
                  {showUnreadOnly ? "Show All" : "Unread Only"}
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filter Tabs */}
              <div className="border-b px-4 py-2">
                <div className="flex gap-2">
                  {(['all', 'calls', 'leads', 'conversions'] as const).map((filterType) => (
                    <Button
                      key={filterType}
                      variant={filter === filterType ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setFilter(filterType)}
                      className="capitalize"
                    >
                      {filterType}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Activity List */}
              <ScrollArea className="h-96">
                <div className="p-4 space-y-3">
                  {filteredActivities.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500">
                      <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No activities to display</p>
                    </div>
                  ) : (
                    filteredActivities.map((activity) => {
                      const IconComponent = getActivityIcon(activity.type);
                      return (
                        <div
                          key={activity.id}
                          className={`p-3 rounded-lg border transition-all ${
                            activity.read 
                              ? "bg-neutral-50 border-neutral-200" 
                              : "bg-blue-50 border-blue-200 shadow-sm"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              activity.read ? "bg-neutral-100" : "bg-blue-100"
                            }`}>
                              <IconComponent className="h-4 w-4 text-neutral-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-medium text-neutral-900">
                                  {activity.title}
                                </h4>
                                <Badge className={getPriorityColor(activity.priority)}>
                                  {activity.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-neutral-600 mt-1">
                                {activity.description}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Clock className="h-3 w-3 text-neutral-400" />
                                <span className="text-xs text-neutral-500">
                                  {activity.timestamp.toLocaleTimeString()}
                                </span>
                                {activity.user && (
                                  <>
                                    <span className="text-neutral-400">•</span>
                                    <span className="text-xs text-neutral-500">
                                      by {activity.user}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Team Status */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50">
                      <div className="relative">
                        <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-neutral-600" />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(member.status)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900">{member.name}</p>
                        <p className="text-xs text-neutral-500 capitalize">{member.status}</p>
                        {member.currentActivity && (
                          <p className="text-xs text-neutral-400 truncate">{member.currentActivity}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Total Activities</span>
                  <span className="text-sm font-medium">{activities.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Unread</span>
                  <Badge variant="destructive">{unreadCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Team Online</span>
                  <span className="text-sm font-medium">
                    {teamMembers.filter(m => m.status === 'online').length}/{teamMembers.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">Last Update</span>
                  <span className="text-xs text-neutral-500">{lastUpdated.toLocaleTimeString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type MaterialName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({
  focused,
  ionIcon,
  matIcon,
  label,
}: {
  focused: boolean;
  ionIcon?: IoniconsName;
  matIcon?: MaterialName;
  label: string;
}) {
  const color = focused ? Colors.tabActive : Colors.tabInactive;
  return matIcon ? (
    <MaterialCommunityIcons name={matIcon} size={24} color={color} />
  ) : (
    <Ionicons name={ionIcon!} size={24} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: {
          fontFamily: 'Montserrat_600SemiBold',
          fontSize: 10,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} ionIcon="home" label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="service"
        options={{
          title: 'Service',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} matIcon="wrench-cog" label="Service" />
          ),
        }}
      />
      <Tabs.Screen
        name="machines"
        options={{
          title: 'Machines',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} matIcon="robot-industrial" label="Machines" />
          ),
        }}
      />
      <Tabs.Screen
        name="automation"
        options={{
          title: 'Automation',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} matIcon="robot" label="Automation" />
          ),
        }}
      />
      <Tabs.Screen
        name="other"
        options={{
          title: 'Contact',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} ionIcon="chatbubble-ellipses" label="Contact" />
          ),
        }}
      />
    </Tabs>
  );
}

import React from 'react';
import { View, Text ,Platform} from 'react-native';
import { CheckCircle, AlertCircle } from 'lucide-react-native';
import DashedHr from '../ui/DashedLine';
interface RegistrationStatusCardProps {
  status: 'confirmed' | 'awaited' | 'payment_pending' | 'rejected' | 'pending';
  eventCategory: string;
  eventType: 'team' | 'individual';
  registeredAt: string;
}

const RegistrationStatusCard: React.FC<RegistrationStatusCardProps> = ({
  status,
  eventCategory,
  eventType,
  registeredAt,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={20} color="#10B981" />;
      case 'awaited':
        return <AlertCircle size={20} color="#F59E0B" />;
      case 'payment_pending':
        return <AlertCircle size={20} color="#F97316" />;
      case 'rejected':
        return <AlertCircle size={20} color="#EF4444" />;
      default:
        return <AlertCircle size={20} color="#6B7280" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'confirmed':
        return 'Registration Confirmed';
      case 'awaited':
        return 'Awaiting Approval';
      case 'payment_pending':
        return 'Payment Pending';
      case 'rejected':
        return 'Registration Rejected';
      default:
        return 'Registration Pending';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'confirmed':
        return 'text-green-400';
      case 'awaited':
        return 'text-[#FEE59C]';
      case 'payment_pending':
        return 'text-orange-400';
      case 'rejected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <View className="mb-6 bg-[#2D1E2F66] rounded-xl p-5">
      <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-[#0C3572] text-lg mb-2">
        Registration Status
      </Text>

      <View className="flex-row items-center mb-1">
        {getStatusIcon()}
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className={`text-lg ml-2 ${getStatusColor()}`}>
          {getStatusText()}
        </Text>
      </View>
       {Platform.OS === "ios" ? <DashedHr className={'mt-5 -mb-2'} color="#ffffff" height={1} dash={[1,1]}  /> : null}
      <View className="border-t border-dashed flex justify-between flex-row border-white pt-4 mt-3">
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-[#2175C0] border-[#0C3572] border-2 px-4 py-2 rounded-2xl text-sm">
          {eventCategory}
        </Text>
        <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-white border-[#0C3572] border-2 px-4 py-2 rounded-2xl text-sm">
          {eventType === 'team' ? 'Team Event' : 'Individual'}
        </Text>
      </View>
      <Text style={{ fontFamily: 'Outfit_500Medium' }} className="text-gray-100 text-center text-sm mt-2">
        Registered on {new Date(registeredAt).toLocaleDateString()}
      </Text>
    </View>
  );
};

export default RegistrationStatusCard;

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerForEvent, createEventTeam, joinEventTeam, leaveTeam, deleteTeam, removeTeamMember } from '@/api/events';

export const useRegisterForEvent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ eventId, responses }: { eventId: string; responses?: any[] }) => 
      registerForEvent(eventId, responses),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useCreateEventTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ eventId, teamName, responses }: { eventId: string; teamName: string; responses?: any[] }) => 
      createEventTeam(eventId, teamName, responses),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useJoinEventTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ eventId, inviteCode, responses }: { eventId: string; inviteCode: string; responses?: any[] }) => 
      joinEventTeam(eventId, inviteCode, responses),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useLeaveTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (teamRef: string) => leaveTeam(teamRef),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (teamRef: string) => deleteTeam(teamRef),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useRemoveTeamMember = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ teamRef, userId }: { teamRef: string; userId: string }) => removeTeamMember(teamRef, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

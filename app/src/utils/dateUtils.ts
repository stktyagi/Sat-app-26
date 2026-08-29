export const getFormattedDate = (dateTime?: string, startDateTime?: string): string => {
  const eventDate = new Date(dateTime || startDateTime || '');
  return eventDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getFormattedTime = (
  dateTime?: string,
  startDateTime?: string,
  endDateTime?: string
): string => {
  const startDate = new Date(dateTime || startDateTime || '');
  const endDate = endDateTime ? new Date(endDateTime) : null;

  const startTime = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (endDate) {
    const endTime = endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${startTime} - ${endTime}`;
  }

  return startTime;
};

export const getRegistrationDeadline = (registrationDeadline?: string): string | null => {
  if (registrationDeadline) {
    const deadline = new Date(registrationDeadline);
    return deadline.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return null;
};

export const getEventDay = (dateTime?: string, startDateTime?: string): string => {
  const eventDate = new Date(dateTime || startDateTime || '');
  return eventDate.getDate().toString();
};

export const getEventMonth = (dateTime?: string, startDateTime?: string): string => {
  const eventDate = new Date(dateTime || startDateTime || '');
  return eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
};

export const getEventTime = (dateTime?: string, startDateTime?: string): string => {
  const eventDate = new Date(dateTime || startDateTime || '');
  return eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};
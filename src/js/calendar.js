// Calendar Integration: Google Calendar Links and iCal (ICS) File Exporters

// Format date to YYYYMMDDTHHmmssZ
function formatToICalDate(dateStr) {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export const Calendar = {
  // Generates web URL for Google Calendar add event
  getGoogleCalendarUrl(contest) {
    const start = formatToICalDate(contest.startTime);
    const end = formatToICalDate(new Date(new Date(contest.startTime).getTime() + contest.duration * 60 * 1000));
    
    const title = encodeURIComponent(`[${contest.platform.toUpperCase()}] ${contest.name}`);
    const details = encodeURIComponent(`Competitive programming contest on ${contest.platform}.\nLink: ${contest.url}`);
    const location = encodeURIComponent(contest.url);
    const dates = `${start}/${end}`;

    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  },

  // Generates and triggers browser download of an .ics file
  downloadICS(contest) {
    const start = formatToICalDate(contest.startTime);
    const end = formatToICalDate(new Date(new Date(contest.startTime).getTime() + contest.duration * 60 * 1000));
    const nowStamp = formatToICalDate(new Date());

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Apex Contest Tracker//EN',
      'BEGIN:VEVENT',
      `UID:${contest.id}@apexcontesttracker.local`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:[${contest.platform.toUpperCase()}] ${contest.name}`,
      `DESCRIPTION:Join the contest here: ${contest.url}`,
      `LOCATION:${contest.url}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contest.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};

using System;

namespace PadelQ.Domain
{
    public static class TimeZoneHelper
    {
        public static DateTime GetArgNow()
        {
            return ToArgTime(DateTime.UtcNow);
        }

        public static DateTime ToArgTime(DateTime utcTime)
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("Argentina Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(utcTime, tz);
            }
            catch
            {
                try
                {
                    var tz = TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");
                    return TimeZoneInfo.ConvertTimeFromUtc(utcTime, tz);
                }
                catch
                {
                    return utcTime.AddHours(-3);
                }
            }
        }
    }
}

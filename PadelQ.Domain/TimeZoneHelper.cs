using System;

namespace PadelQ.Domain
{
    public static class TimeZoneHelper
    {
        public static DateTime GetArgNow()
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("Argentina Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            }
            catch
            {
                try
                {
                    var tz = TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires");
                    return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                }
                catch
                {
                    return DateTime.UtcNow.AddHours(-3);
                }
            }
        }
    }
}

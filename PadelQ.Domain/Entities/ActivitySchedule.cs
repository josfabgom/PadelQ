using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace PadelQ.Domain.Entities
{
    public class ActivitySchedule
    {
        public int Id { get; set; }
        public int ActivityId { get; set; }
        public DayOfWeek DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }

        [ForeignKey("ActivityId")]
        public virtual ClubActivity? Activity { get; set; }
    }
}

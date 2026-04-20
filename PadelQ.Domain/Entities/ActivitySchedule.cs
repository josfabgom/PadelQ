using System;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace PadelQ.Domain.Entities
{
    public class ActivitySchedule
    {
        public int Id { get; set; }
        public int ActivityId { get; set; }
        public DayOfWeek DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }

        [JsonPropertyName("courtId")]
        public int? CourtId { get; set; }
        [JsonPropertyName("spaceId")]
        public int? SpaceId { get; set; }

        [ForeignKey("ActivityId")]
        public virtual ClubActivity? Activity { get; set; }

        [ForeignKey("CourtId")]
        public virtual Court? Court { get; set; }

        [ForeignKey("SpaceId")]
        public virtual Space? Space { get; set; }
    }
}

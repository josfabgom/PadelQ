using Microsoft.EntityFrameworkCore;
using PadelQ.Application.Common.Interfaces;
using PadelQ.Domain.Entities;
using PadelQ.Infrastructure.Persistence;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace PadelQ.Infrastructure.Services
{
    public class ActivityService : IActivityService
    {
        private readonly ApplicationDbContext _context;

        public ActivityService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<ClubActivity>> GetAllAsync()
        {
            var activities = await _context.ClubActivities
                .Include(a => a.Schedules)
                .Where(a => a.IsActive)
                .ToListAsync();

            foreach (var activity in activities)
            {
                activity.CurrentSignups = await _context.ActivitySignups.CountAsync(s => s.ActivityId == activity.Id);
            }

            return activities;
        }

        public async Task<ClubActivity?> GetByIdAsync(int id)
        {
            var activity = await _context.ClubActivities
                .Include(a => a.Schedules)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (activity != null)
            {
                activity.CurrentSignups = await _context.ActivitySignups.CountAsync(s => s.ActivityId == activity.Id);
            }

            return activity;
        }

        public async Task<int> CreateAsync(ClubActivity activity)
        {
            _context.ClubActivities.Add(activity);
            await _context.SaveChangesAsync();
            return activity.Id;
        }

        public async Task UpdateAsync(ClubActivity activity)
        {
            var dbActivity = await _context.ClubActivities
                .Include(a => a.Schedules)
                .FirstOrDefaultAsync(a => a.Id == activity.Id);

            if (dbActivity != null)
            {
                dbActivity.Name = activity.Name;
                dbActivity.Description = activity.Description;
                dbActivity.InstructorName = activity.InstructorName;
                dbActivity.Price = activity.Price;
                dbActivity.MaxCapacity = activity.MaxCapacity;
                dbActivity.IsActive = activity.IsActive;

                // Update Schedules
                var existingSchedules = dbActivity.Schedules.ToList();
                foreach (var s in existingSchedules)
                {
                    _context.ActivitySchedules.Remove(s);
                }

                foreach (var s in activity.Schedules)
                {
                    var newSchedule = new ActivitySchedule
                    {
                        ActivityId = dbActivity.Id,
                        DayOfWeek = s.DayOfWeek,
                        StartTime = s.StartTime,
                        EndTime = s.EndTime,
                        CourtId = s.CourtId,
                        SpaceId = s.SpaceId
                    };
                    _context.ActivitySchedules.Add(newSchedule);
                }

                await _context.SaveChangesAsync();
            }
        }

        public async Task<(bool Succeeded, string Message)> SignupAsync(string userId, int activityId)
        {
            var activity = await _context.ClubActivities
                .Include(a => a.Schedules)
                .FirstOrDefaultAsync(a => a.Id == activityId);

            if (activity == null) return (false, "Actividad no encontrada.");
            
            // Check if already signed up
            var alreadySignedUp = await _context.ActivitySignups
                .AnyAsync(s => s.ActivityId == activityId && s.UserId == userId);
            
            if (alreadySignedUp) return (false, "Ya estás inscrito en esta actividad.");

            // Check capacity
            var currentSignups = await _context.ActivitySignups.CountAsync(s => s.ActivityId == activityId);
            if (currentSignups >= activity.MaxCapacity) return (false, "La actividad ha alcanzado su capacidad máxima.");

            var signup = new ActivitySignup
            {
                ActivityId = activityId,
                UserId = userId
            };

            _context.ActivitySignups.Add(signup);

            // Crear cargo en la cuenta del usuario si la actividad tiene precio
            if (activity.Price > 0)
            {
                var membershipDiscount = await _context.UserMemberships
                    .Include(um => um.Membership)
                    .Where(um => um.UserId == userId && um.IsActive)
                    .Select(um => um.Membership != null ? um.Membership.DiscountPercentage : 0)
                    .FirstOrDefaultAsync();

                var finalPrice = activity.Price * (1 - (membershipDiscount / 100m));

                var transaction = new Transaction
                {
                    UserId = userId,
                    Amount = finalPrice,
                    Type = TransactionType.Charge,
                    Date = DateTime.UtcNow,
                    Description = $"Inscripción a actividad: {activity.Name} (Descuento membresía aplicado)"
                };
                _context.Transactions.Add(transaction);
            }

            await _context.SaveChangesAsync();

            return (true, "Inscripción exitosa.");
        }

        public async Task DeleteAsync(int id)
        {
            var activity = await _context.ClubActivities.FindAsync(id);
            if (activity != null)
            {
                activity.IsActive = false;
                await _context.SaveChangesAsync();
            }
        }
    }
}

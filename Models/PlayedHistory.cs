using System.ComponentModel.DataAnnotations;

namespace SpotifyClone.Models;

public class PlayedHistory
{
    public int Id { get; set; }

    [Required]
    public string UserId { get; set; }

    [Required]
    public int SongId { get; set; }

    public Song Song { get; set; }

    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;
}
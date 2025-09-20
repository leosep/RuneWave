using System.ComponentModel.DataAnnotations;

namespace SpotifyClone.Models;

public class Song
{
    public int Id { get; set; }

    [Required]
    public string Title { get; set; }

    public string? Artist { get; set; }

    public string? Album { get; set; }

    [Required]
    public string FilePath { get; set; }

    [Required]
    public string UserId { get; set; } // Foreign key to IdentityUser

    public string? AlbumArtUrl { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
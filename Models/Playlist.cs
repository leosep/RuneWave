using System.ComponentModel.DataAnnotations;

namespace SpotifyClone.Models;

public class Playlist
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; }

    [Required]
    public string UserId { get; set; } // Foreign key to IdentityUser

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PlaylistSong> PlaylistSongs { get; set; } = new List<PlaylistSong>();
}
using System.ComponentModel.DataAnnotations;

namespace SpotifyClone.Models;

public class PlaylistSong
{
    public int Id { get; set; }

    [Required]
    public int PlaylistId { get; set; }

    [Required]
    public int SongId { get; set; }

    public Playlist Playlist { get; set; }

    public Song Song { get; set; }
}
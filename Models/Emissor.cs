using System.ComponentModel.DataAnnotations;

namespace SpotifyClone.Models;

public class Emissor
{
    public int Id { get; set; }

    [Required]
    public string Name { get; set; }

    [Required]
    public string Country { get; set; }

    [Required]
    public string StreamUrl { get; set; }

    public string? LogoUrl { get; set; }

    public string? Category { get; set; }

    public string? Description { get; set; }
}

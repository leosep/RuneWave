using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpotifyClone.Data;
using SpotifyClone.Models;
using System.Security.Claims;

namespace SpotifyClone.Controllers;

[Authorize]
public class PlaylistsController : Controller
{
    private readonly ApplicationDbContext _context;

    public PlaylistsController(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IActionResult> Index()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var playlists = await _context.Playlists
            .Where(p => p.UserId == userId)
            .Include(p => p.PlaylistSongs)
            .ThenInclude(ps => ps.Song)
            .ToListAsync();
        return View(playlists);
    }

    [HttpGet]
    public IActionResult Create()
    {
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> Create(string name)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var playlist = new Playlist
        {
            Name = name,
            UserId = userId
        };
        _context.Playlists.Add(playlist);
        await _context.SaveChangesAsync();

        // Check if this is an AJAX request
        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
        {
            return Json(new { success = true, id = playlist.Id, name = playlist.Name });
        }

        return RedirectToAction("Index");
    }

    [HttpPost]
    public async Task<IActionResult> AddSong(int playlistId, int songId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var playlist = await _context.Playlists.FindAsync(playlistId);
        if (playlist == null || playlist.UserId != userId)
        {
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return Json(new { success = false, message = "Playlist not found" });
            }
            return NotFound();
        }
        var song = await _context.Songs.FindAsync(songId);
        if (song == null || song.UserId != userId)
        {
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return Json(new { success = false, message = "Song not found" });
            }
            return NotFound();
        }

        // Check if song is already in playlist
        var existing = await _context.PlaylistSongs
            .FirstOrDefaultAsync(ps => ps.PlaylistId == playlistId && ps.SongId == songId);
        if (existing != null)
        {
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return Json(new { success = false, message = "Song is already in this playlist" });
            }
            return BadRequest("Song is already in this playlist");
        }

        var playlistSong = new PlaylistSong
        {
            PlaylistId = playlistId,
            SongId = songId
        };
        _context.PlaylistSongs.Add(playlistSong);
        await _context.SaveChangesAsync();

        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
        {
            return Json(new { success = true, message = "Song added to playlist" });
        }

        return RedirectToAction("Index");
    }

    public async Task<IActionResult> Details(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var playlist = await _context.Playlists
            .Include(p => p.PlaylistSongs)
            .ThenInclude(ps => ps.Song)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
        if (playlist == null)
        {
            return NotFound();
        }

        // Get available songs for adding
        var availableSongs = await _context.Songs
            .Where(s => s.UserId == userId && !_context.PlaylistSongs.Any(ps => ps.PlaylistId == id && ps.SongId == s.Id))
            .ToListAsync();
        ViewBag.AvailableSongs = availableSongs;

        return View(playlist);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateOrder(int playlistId, List<int> songIds)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var playlist = await _context.Playlists.FindAsync(playlistId);
        if (playlist == null || playlist.UserId != userId)
        {
            return BadRequest();
        }

        // Update order - for simplicity, just reorder by songIds
        var playlistSongs = await _context.PlaylistSongs
            .Where(ps => ps.PlaylistId == playlistId)
            .ToListAsync();

        for (int i = 0; i < songIds.Count; i++)
        {
            var ps = playlistSongs.FirstOrDefault(p => p.SongId == songIds[i]);
            if (ps != null)
            {
                ps.Id = i + 1; // Simple ordering
            }
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> Delete([FromBody] int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var playlist = await _context.Playlists
            .Include(p => p.PlaylistSongs)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);

        if (playlist == null)
        {
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return Json(new { success = false, message = "Playlist not found" });
            }
            return NotFound();
        }

        // Remove all playlist songs first (cascade delete will handle this, but being explicit)
        _context.PlaylistSongs.RemoveRange(playlist.PlaylistSongs);
        _context.Playlists.Remove(playlist);
        await _context.SaveChangesAsync();

        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
        {
            return Json(new { success = true, message = "Playlist deleted successfully" });
        }

        return RedirectToAction("Index");
    }

    [HttpPost]
    public async Task<IActionResult> RemoveSong([FromBody] RemoveSongRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var playlist = await _context.Playlists.FindAsync(request.PlaylistId);

        if (playlist == null || playlist.UserId != userId)
        {
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return Json(new { success = false, message = "Playlist not found" });
            }
            return NotFound();
        }

        var playlistSong = await _context.PlaylistSongs
            .FirstOrDefaultAsync(ps => ps.PlaylistId == request.PlaylistId && ps.SongId == request.SongId);

        if (playlistSong == null)
        {
            if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
            {
                return Json(new { success = false, message = "Song not found in playlist" });
            }
            return NotFound();
        }

        _context.PlaylistSongs.Remove(playlistSong);
        await _context.SaveChangesAsync();

        if (Request.Headers["X-Requested-With"] == "XMLHttpRequest")
        {
            return Json(new { success = true, message = "Song removed from playlist" });
        }

        return RedirectToAction("Details", new { id = request.PlaylistId });
    }

    public class RemoveSongRequest
    {
        public int PlaylistId { get; set; }
        public int SongId { get; set; }
    }
}
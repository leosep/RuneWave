using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpotifyClone.Data;
using SpotifyClone.Models;
using SpotifyClone.Services;
using System.Security.Claims;
using Microsoft.Extensions.Logging;

namespace SpotifyClone.Controllers;

[Authorize]
public class SongsController : Controller
{
    private readonly ApplicationDbContext _context;
    private readonly MusicScannerService _scannerService;
    private readonly ILogger<SongsController> _logger;

    public SongsController(ApplicationDbContext context, MusicScannerService scannerService, ILogger<SongsController> logger)
    {
        _context = context;
        _scannerService = scannerService;
        _logger = logger;
    }

    public async Task<IActionResult> Index(string search = "", int page = 1)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("Index called with search='{Search}', page={Page}, userId={UserId}", search, page, userId);

        try
        {
            var query = _context.Songs.Where(s => s.UserId == userId);

            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(s =>
                    s.Title.ToLower().Contains(searchLower) ||
                    (s.Artist != null && s.Artist.ToLower().Contains(searchLower)) ||
                    (s.Album != null && s.Album.ToLower().Contains(searchLower)));
            }

            const int pageSize = 12;
            var totalSongs = await query.CountAsync();
            var songs = await query
                .OrderBy(s => s.Title)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            _logger.LogInformation("Returning {Count} songs, IDs: {Ids}", songs.Count, string.Join(", ", songs.Select(s => s.Id)));

            // Get user's playlists for the "Add to Playlist" functionality
            var playlists = await _context.Playlists
                .Where(p => p.UserId == userId)
                .OrderBy(p => p.Name)
                .ToListAsync();

            ViewBag.Search = search;
            ViewBag.CurrentPage = page;
            ViewBag.TotalPages = (int)Math.Ceiling(totalSongs / (double)pageSize);
            ViewBag.Playlists = playlists;

            return View(songs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in Index action with search='{Search}', userId={UserId}", search, userId);
            throw;
        }
    }

    [HttpPost]
    public async Task<IActionResult> Scan()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        await _scannerService.ScanAndImportSongsAsync(userId);
        return RedirectToAction("Index");
    }

    public async Task<IActionResult> Play(int id)
    {
        var song = await _context.Songs.FindAsync(id);
        if (song == null || song.UserId != User.FindFirstValue(ClaimTypes.NameIdentifier))
        {
            return NotFound();
        }
        return View(song);
    }

    [HttpPost]
    public async Task<IActionResult> TrackPlay(int songId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("TrackPlay called for song {SongId} by user {UserId}", songId, userId);

        // Verify the song exists and belongs to the user
        var song = await _context.Songs.FindAsync(songId);
        if (song == null || song.UserId != userId)
        {
            _logger.LogWarning("TrackPlay failed: Song {SongId} not found or access denied for user {UserId}", songId, userId);
            return BadRequest("Song not found or access denied");
        }

        var history = new PlayedHistory
        {
            UserId = userId,
            SongId = songId
        };
        _context.PlayedHistories.Add(history);
        await _context.SaveChangesAsync();
        _logger.LogInformation("Added play history for song {SongId} by user {UserId}", songId, userId);
        return Ok();
    }

    public async Task<IActionResult> RecentlyPlayed()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("RecentlyPlayed called for user {UserId}", userId);

        // Get the most recent play history entries
        var recentHistory = await _context.PlayedHistories
            .Where(h => h.UserId == userId)
            .OrderByDescending(h => h.PlayedAt)
            .Take(50) // Take more to get distinct songs
            .ToListAsync();

        _logger.LogInformation("Found {Count} played history entries for user {UserId}", recentHistory.Count, userId);

        // Get distinct songs by taking the first occurrence of each song
        var seenSongIds = new HashSet<int>();
        var recentSongs = new List<Song>();

        foreach (var history in recentHistory)
        {
            if (!seenSongIds.Contains(history.SongId))
            {
                var song = await _context.Songs.FindAsync(history.SongId);
                if (song != null)
                {
                    recentSongs.Add(song);
                    seenSongIds.Add(history.SongId);
                }
                else
                {
                    _logger.LogWarning("Song with ID {SongId} not found for user {UserId}", history.SongId, userId);
                }
            }

            if (recentSongs.Count >= 20) break;
        }

        _logger.LogInformation("Returning {Count} recent songs for user {UserId}", recentSongs.Count, userId);
        return View(recentSongs);
    }

    [HttpPost]
    public async Task<IActionResult> ToggleFavorite(int songId)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("ToggleFavorite called for song {SongId} by user {UserId}", songId, userId);

        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogWarning("ToggleFavorite failed: User not authenticated");
            return BadRequest("User not authenticated");
        }

        // Verify the song exists and belongs to the user
        var song = await _context.Songs.FindAsync(songId);
        if (song == null)
        {
            _logger.LogWarning("ToggleFavorite failed: Song {SongId} not found", songId);
            return BadRequest($"Song with ID {songId} not found");
        }
        if (song.UserId != userId)
        {
            _logger.LogWarning("ToggleFavorite failed: Song {SongId} does not belong to user {UserId}", songId, userId);
            return BadRequest("Song does not belong to current user");
        }

        var existing = await _context.Favorites
            .FirstOrDefaultAsync(f => f.UserId == userId && f.SongId == songId);

        if (existing != null)
        {
            _context.Favorites.Remove(existing);
            _logger.LogInformation("Removed favorite for song {SongId} by user {UserId}", songId, userId);
        }
        else
        {
            _context.Favorites.Add(new Favorite { UserId = userId, SongId = songId });
            _logger.LogInformation("Added favorite for song {SongId} by user {UserId}", songId, userId);
        }

        await _context.SaveChangesAsync();
        return Ok();
    }

    public async Task<IActionResult> Favorites()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        _logger.LogInformation("Favorites called for user {UserId}", userId);

        var favorites = await _context.Favorites
            .Where(f => f.UserId == userId)
            .Include(f => f.Song)
            .Select(f => f.Song)
            .ToListAsync();

        _logger.LogInformation("Found {Count} favorite songs for user {UserId}", favorites.Count, userId);
        return View(favorites);
    }

    [HttpGet]
    public async Task<IActionResult> Stream(int id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var song = await _context.Songs.FindAsync(id);
        if (song == null || song.UserId != userId)
        {
            return NotFound();
        }

        if (!System.IO.File.Exists(song.FilePath))
        {
            return NotFound();
        }

        var stream = System.IO.File.OpenRead(song.FilePath);
        return File(stream, "audio/mpeg", enableRangeProcessing: true);
    }
}
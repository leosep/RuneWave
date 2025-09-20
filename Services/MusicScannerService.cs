using SpotifyClone.Data;
using SpotifyClone.Models;
using System.Security.Claims;
using TagLib;
using Microsoft.Extensions.Caching.Memory;

namespace SpotifyClone.Services;

public class MusicScannerService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;

    public MusicScannerService(ApplicationDbContext context, IConfiguration configuration, HttpClient httpClient, IMemoryCache cache)
    {
        _context = context;
        _configuration = configuration;
        _httpClient = httpClient;
        _cache = cache;
    }

    public async Task ScanAndImportSongsAsync(string userId)
    {
        var musicFolder = _configuration["MusicFolder"];
        if (string.IsNullOrEmpty(musicFolder) || !Directory.Exists(musicFolder))
        {
            return;
        }

        var mp3Files = Directory.GetFiles(musicFolder, "*.mp3", SearchOption.AllDirectories);

        foreach (var filePath in mp3Files)
        {
            // Check if song already exists
            if (_context.Songs.Any(s => s.FilePath == filePath))
            {
                continue;
            }

            try
            {
                var file = TagLib.File.Create(filePath);
                var title = file.Tag.Title ?? Path.GetFileNameWithoutExtension(filePath);
                var artist = file.Tag.FirstPerformer ?? "Unknown Artist";
                var album = file.Tag.Album ?? "Unknown Album";

                // Fetch album art from iTunes API
                var albumArtUrl = await FetchAlbumArtAsync(artist, album);

                var song = new Song
                {
                    Title = title,
                    Artist = artist,
                    Album = album,
                    FilePath = filePath,
                    UserId = userId,
                    AlbumArtUrl = albumArtUrl
                };

                _context.Songs.Add(song);
            }
            catch
            {
                // Skip invalid files
            }
        }

        await _context.SaveChangesAsync();
    }

    private async Task<string> FetchAlbumArtAsync(string artist, string album)
    {
        var cacheKey = $"albumart_{artist}_{album}";
        if (_cache.TryGetValue(cacheKey, out string cachedUrl))
        {
            return cachedUrl;
        }

        try
        {
            var query = $"{artist} {album}".Replace(" ", "+");
            var url = $"https://itunes.apple.com/search?term={query}&entity=album&limit=1";

            var response = await _httpClient.GetStringAsync(url);
            var json = System.Text.Json.JsonDocument.Parse(response);

            if (json.RootElement.GetProperty("resultCount").GetInt32() > 0)
            {
                var artworkUrl = json.RootElement.GetProperty("results")[0].GetProperty("artworkUrl100").GetString();
                var highResUrl = artworkUrl.Replace("100x100", "600x600");
                _cache.Set(cacheKey, highResUrl, TimeSpan.FromHours(24));
                return highResUrl;
            }
        }
        catch
        {
            // Ignore errors
        }

        var fallback = "";
        _cache.Set(cacheKey, fallback, TimeSpan.FromHours(1));
        return fallback;
    }
}
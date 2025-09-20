# RuneWave

RuneWave is a music streaming web application built with ASP.NET Core, inspired by Spotify. It allows users to upload, organize, and stream their music collection with features like playlists, favorites, and recently played tracks.

## Features

- **User Authentication**: Secure login and registration system
- **Music Upload**: Scan and import MP3 files from a specified folder
- **Music Playback**: Stream audio files with a responsive player
- **Playlists**: Create and manage custom playlists
- **Favorites**: Mark songs as favorites for quick access
- **Recently Played**: View recently played songs
- **Responsive Design**: Works on desktop and mobile devices
- **Album Art**: Automatic fetching of album artwork from iTunes API

## Technologies Used

- **Backend**: ASP.NET Core 9.0
- **Database**: SQL Server with Entity Framework Core
- **Frontend**: Razor Pages, Tailwind CSS, JavaScript
- **Audio Processing**: TagLib# for metadata extraction
- **Authentication**: ASP.NET Core Identity

## Prerequisites

- .NET 9.0 SDK
- SQL Server (or SQL Server Express)
- A folder containing MP3 files for music scanning

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/leosep/RuneWave.git
   cd RuneWave
   ```

2. Update the connection string in `appsettings.json`:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=your-server;Database=RuneWaveDB;User Id=your-user;Password=your-password;TrustServerCertificate=True"
   }
   ```

3. Set the music folder path in `appsettings.json`:
   ```json
   "MusicFolder": "C:\\Path\\To\\Your\\Music\\Folder"
   ```

4. Run the application:
   ```bash
   dotnet run
   ```

5. Navigate to `https://localhost:7227` in your browser.

## Usage

1. **Register/Login**: Create an account or log in with existing credentials.

2. **Scan Music**: Click "Scan Music Folder" to import MP3 files from the specified folder.

3. **Browse Songs**: View your music library with search and pagination.

4. **Play Music**: Click the play button on any song to start streaming.

5. **Create Playlists**: Use the Playlists section to organize your music.

6. **Add Favorites**: Click the ❤️ button to add songs to your favorites.

7. **View Recently Played**: Access the Recently Played section to see your listening history.

## Project Structure

- `Controllers/`: ASP.NET Core controllers
- `Models/`: Entity Framework models
- `Views/`: Razor views
- `Services/`: Business logic services
- `Data/`: Database context and migrations
- `wwwroot/`: Static files (CSS, JS, images)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

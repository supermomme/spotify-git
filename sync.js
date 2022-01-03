var SpotifyWebApi = require('spotify-web-api-node');
var fs = require('fs');

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

const getAllTracksOfPlaylist = async (playlistId, limit = 100, offset = 0) => {
  const tracks = []
  const result = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit })
  tracks.push(...result.body.items)
  if (result.body.total > offset+limit) tracks.push(...(await getAllTracksOfPlaylist(playlistId, result.body.limit, result.body.offset+result.body.limit)))
  return tracks
}

const getPlaylistMeta = async (playlistId) => {
  const meta = await spotifyApi.getPlaylist(playlistId)
  return meta.body
}

const saveMarkdown = (filepath, tracks, meta) => {

  const metaBegin = '<!-- META_BEGIN -->\n'
  const metaEnd = '<!-- META_END -->\n'
  const metaString = [
    `- Id: ${meta.id}`,
    `- Owner: [${meta.owner.display_name}](${meta.owner.external_urls.spotify})`,
    `- Public: ${meta.public ? 'Yes' : 'No' }`,
    `- Track Count: ${meta.tracks.total}`,
    `- Follower Count: ${meta.followers.total}`
  ].join('\n') + '\n'

  const trackBegin = '<!-- TRACK_LIST_BEGIN -->\n'
  const trackEnd = '<!-- TRACK_LIST_END -->\n'
  const trackString = tracks.map(track => `- (${track.track.id}) [${track.track.name}](${track.track.external_urls.spotify}) *by* ${track.track.artists.map(a => `[${a.name}](${a.external_urls.spotify})`).join(', ')}`).join('\n') + '\n'

  const markdown = [
    `# [${meta.name}](${meta.external_urls.spotify})\n`,
    '## Informations\n',
    metaBegin,
    metaString,
    metaEnd,
    '\n\n',
    '## Tracks\n',
    trackBegin,
    trackString,
    trackEnd
  ].join('')
  fs.writeFileSync(filepath, markdown)
}

const main = async () => {
  const data = await spotifyApi.clientCredentialsGrant()
  spotifyApi.setAccessToken(data.body['access_token'])

  const playlistIds = require('./playlists/playlist.json')
  const playlists = []
  for (const playlistId of playlistIds) {
    try {
      console.log(`Get Playlist ${playlistId}`)
      const tracks = await getAllTracksOfPlaylist(playlistId)
      const playlistMeta = await getPlaylistMeta(playlistId)
      playlists.push(playlistMeta)
      console.log(`Save Markdown for Playlist ${playlistId}`)
      saveMarkdown(`${__dirname}/playlists/${playlistId}.md`, tracks, playlistMeta)
    } catch (error) {
      console.error(`ERROR ON PLAYLIST ${playlistId}`)
      console.error(error)
    }
  }

  const readmeMarkdownArray = fs.readFileSync('./README.md', 'utf8').split('\n')
  const startIndex = readmeMarkdownArray.findIndex(s => s.includes('<!-- PLAYLIST_LIST_START -->'))
  const endIndex = readmeMarkdownArray.findIndex(s => s.includes('<!-- PLAYLIST_LIST_END -->'))

  if (endIndex-1 > startIndex) readmeMarkdownArray.splice(startIndex+1, endIndex-startIndex-1) // Clear everything between start and end

  for (const playlist of playlists) {
    readmeMarkdownArray.splice(startIndex+1, 0, `- [${playlist.name}](./playlists/${playlist.id}.md) by ${playlist.owner.display_name}`)
  }
  fs.writeFileSync('./README.md', readmeMarkdownArray.join('\n'), 'utf8')
}
main()

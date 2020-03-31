#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const url = `https://static.juke.nl/content/stations.json?preventCache=${new Date().getTime()}`;
const filename = 'juke-stations.xspf';
const playlistTitle = 'JUKE.nl Stations'
const playlistCreator = 'JUKE Playlist Generator';
const playlistInfo = 'https://github.com/Ex-iT/';
const outputFile = path.join(process.env.HOME || process.env.USERPROFILE, 'Documents', filename);

function init() {
	getStationsJson(url)
		.then(response => JSON.parse(response))
		.then(stations => generatePlaylist(generateTracks(stations)))
		.catch(error => {
			console.log(`[-] An error occured while trying to get the stations: ${error}`);
			process.exit(1);
		});
}

function generateTracks(stations) {
	return stations.map(station => {
		let location = station.audioUrlAac;
		if (station.audioUrlAac && station.audioUrlAac.indexOf('http://') === -1) {
			location = encodeUri(station.audioUrl);
		} else {
			location = station.audioUrlAac ? encodeUri(station.audioUrlAac) : (station.audioUrl ? encodeUri(station.audioUrl) : encodeUri(station.tritonMount));
		}

		// Exceptions for bad Triton locations
		const streamRegExp = /https?:\/\/\d+\.live.streamtheworld.com/;
		if (station.type === 'triton' && location.match(streamRegExp)) {
			location = location.replace(location.match(streamRegExp)[0], 'https://playerservices.streamtheworld.com/api/livestream-redirect');
		}

		return {
			title: escapeHtml(station.name),
			info: station.metadata ? escapeHtml(station.metadata.description) : '',
			image: station.image.url ? station.image.url : '',
			location
		};
	}).sort((a, b) => {
		if (a.title < b.title) return -1;
		if (a.title > b.title) return 1;
		return 0;
	});
}

function generatePlaylist(tracks) {
	const data = `<?xml version="1.0" encoding="UTF-8"?>
<playlist version="1" xmlns="http://xspf.org/ns/0/">
	<title>${playlistTitle}</title>
	<creator>${playlistCreator}</creator>
	<info>${playlistInfo}</info>
	<date>${new Date().toISOString()}</date>
	<trackList>
		${tracks.map(track => `<track>
			<title>${track.title}</title>
			<info>${track.info}</info>
			<image>${track.image}</image>
			<location>${track.location}</location>
		</track>`).join('\n\t\t')}
	</trackList>
</playlist>`;

	writePlaylist(data);
}

function writePlaylist(data) {
	fs.writeFile(outputFile, data, error => {
		if (error) {
			console.log(`[-] An error occured writing the file: ${error}`);
			process.exit(1);
		}
		console.log(`[+] Playlist saved to: ${outputFile}`);
		process.exit();
	});
}

function getStationsJson(url) {
	return new Promise((resolve, reject) => {
		fetch(url)
			.then(response => response.text())
			.then(json => resolve(json))
			.catch(error => reject(error));
	});
}

function encodeUri(uri) {
	return uri
		.replace(/&/g, '%26');
}

function escapeHtml(html) {
	return html
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

init();

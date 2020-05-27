#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const urlStations = `https://static.juke.nl/content/stations.json?preventCache=${new Date().getTime()}`;
const urlStationBase = 'https://graph.talparad.io';
const apiKey = 'da2-evfzzjsvjjhy3isb6ursfis2ue';
const filename = 'juke-stations.xspf';
const playlistTitle = 'JUKE.nl Stations'
const playlistCreator = 'JUKE Playlist Generator';
const playlistInfo = 'https://github.com/Ex-iT/';
const outputFile = path.join(process.env.HOME || process.env.USERPROFILE, 'Documents', filename);

function init() {
	fetchJson(urlStations)
		.then(response => JSON.parse(response))
		.then(stations => {
			const stationDataPromises = stations
				.map(station => ({ slug: station.slug, description: station.metadata ? station.metadata.description : '' }))
				.map(metaData => getStationData(metaData.slug, metaData.description).then(station => station));

			Promise.all(stationDataPromises).then(stationsData => {
				generatePlaylist(generateTracks(stationsData.filter(Boolean)));
			});

		})
		.catch(error => {
			console.log(`[-] An error occured while trying to get the stations: ${error}`);
			process.exit(1);
		});
}

function getStationData(slug, metaDescription, profile = 'juke-web') {
	const urlStation = `${urlStationBase}/?query=query+GetStation($profile:+String!,+$slug:+String!)+%7B%0A++station:+getStation(profile:+$profile,+slug:+$slug)+%7B%0A++++id%0A++++type%0A++++title%0A++++description%0A++++shortTitle%0A++++slug%0A++++media+%7B%0A++++++...MediaFragment%0A++++%7D%0A++++images+%7B%0A++++++...ImageFragment%0A++++%7D%0A++++tags+%7B%0A++++++slug%0A++++++title%0A++++++type%0A++++%7D%0A++++config+%7B%0A++++++type%0A++++++entries+%7B%0A++++++++key%0A++++++++value%0A++++++++type%0A++++++%7D%0A++++%7D%0A++%7D%0A%7D%0A%0Afragment+MediaFragment+on+Media+%7B%0A++uri%0A++source%0A%7D%0A%0Afragment+ImageFragment+on+Image+%7B%0A++uri%0A++imageType%0A++title%0A%7D%0A&variables=%7B%22profile%22:%22${profile}%22,%22slug%22:%22${slug}%22%7D`;
	const options = { headers: { 'x-api-key': apiKey } };

	return fetchJson(urlStation, options)
		.then(response => JSON.parse(response))
		.then(json => json.data.station ? json.data.station : null)
		.then(station => {
			if (station) {
				station.metaDescription = metaDescription;
				return station;
			}
		});
}

function generateTracks(stationsData) {
	return stationsData
		.map(stationData => {
			const { media, images } = stationData;
			const logo = images.filter(image => image.imageType === 'logo');

			return {
				title: encodeHtml(stationData.title || station.slug),
				info: encodeHtml(stationsData.description || stationData.shortTitle || stationData.metaDescription || ''),
				image: encodeHtml(logo.length ? logo[0].uri : (images[0].uri || '')),
				media: encodeHtml(media.length ? media[0].uri : '')
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
			<location>${track.media}</location>
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

function fetchJson(url, options = {}) {
	return new Promise((resolve, reject) => {
		fetch(url, options)
			.then(response => response.text())
			.then(json => resolve(json))
			.catch(error => reject(error));
	});
}

function encodeHtml(str) {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

init();

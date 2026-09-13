import crowdlist from './img/crowdlist.png';
import deleteMedia from './img/deleteMedia.png';
import deleteMediaSelf from './img/deleteMediaSelf.png';
import down from './img/down.png';
import emoji from './img/emoji.png';
import forbid from './img/forbid.png';
import kermaEnough from './img/kermaEnough.png';
import kermaNotEnough from './img/kermaNotEnough.png';
import largeLoading from './img/largeLoading.gif';
import logo180 from './img/logo180.png';
import nsfwOff from './img/nsfwOff.png';
import nsfwOn from './img/nsfwOn.png';
import poster from './img/poster.png';
import posterSmall from './img/posterSmall.png';
import smallLoading from './img/smallLoading.gif';
import up from './img/up.png';
import upload from './img/upload.png';
import voteBurn from './img/voteBurn.png';
import voteForbid from './img/voteForbid.png';
import voteForbidSmall from './img/voteForbidSmall.png';
import voteMinKerma from './img/voteMinKerma.png';
import voteNormal from './img/voteNormal.png';

export interface BundleImage {
  src: string;
  width: number;
  height: number;
}

export const IMG = {
  crowdlist: { src: crowdlist, width: 48, height: 48 },
  deleteMedia: { src: deleteMedia, width: 32, height: 32 },
  deleteMediaSelf: { src: deleteMediaSelf, width: 32, height: 32 },
  down: { src: down, width: 32, height: 32 },
  emoji: { src: emoji, width: 48, height: 48 },
  forbid: { src: forbid, width: 48, height: 48 },
  kermaEnough: { src: kermaEnough, width: 255, height: 27 },
  kermaNotEnough: { src: kermaNotEnough, width: 242, height: 26 },
  largeLoading: { src: largeLoading, width: 64, height: 64 },
  logo180: { src: logo180, width: 179, height: 61 },
  nsfwOff: { src: nsfwOff, width: 32, height: 33 },
  nsfwOn: { src: nsfwOn, width: 32, height: 33 },
  poster: { src: poster, width: 48, height: 48 },
  posterSmall: { src: posterSmall, width: 32, height: 32 },
  smallLoading: { src: smallLoading, width: 32, height: 32 },
  up: { src: up, width: 32, height: 32 },
  upload: { src: upload, width: 48, height: 48 },
  voteBurn: { src: voteBurn, width: 48, height: 48 },
  voteForbid: { src: voteForbid, width: 48, height: 48 },
  voteForbidSmall: { src: voteForbidSmall, width: 32, height: 32 },
  voteMinKerma: { src: voteMinKerma, width: 48, height: 48 },
  voteNormal: { src: voteNormal, width: 48, height: 48 },
} as const satisfies Record<string, BundleImage>;

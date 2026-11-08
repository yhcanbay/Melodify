import { Capacitor } from '@capacitor/core'
import { createAndroidPlatform } from './native'
import { createWebPlatform } from './web'

export const mobilePlatform = Capacitor.getPlatform() === 'android' ? createAndroidPlatform() : createWebPlatform()

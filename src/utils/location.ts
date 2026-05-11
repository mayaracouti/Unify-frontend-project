import * as Location from "expo-location";

export type AutoLocation = {
  latitude: number;
  longitude: number;
};

export type ForegroundLocationPermissionState = {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
};

export type CurrentDeviceLocationRequestResult = {
  location: AutoLocation | null;
  permission: ForegroundLocationPermissionState;
};

const LOCATION_REQUEST_TIMEOUT_MS = 10000;

function mapPermissionState(
  permission: Location.LocationPermissionResponse
): ForegroundLocationPermissionState {
  return {
    granted: permission.status === Location.PermissionStatus.GRANTED,
    canAskAgain: permission.canAskAgain,
    status: permission.status,
  };
}

async function waitForCurrentPosition(): Promise<Location.LocationObject | null> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const currentPosition = await Promise.race<Location.LocationObject | null>([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve(null);
        }, LOCATION_REQUEST_TIMEOUT_MS);
      }),
    ]);

    return currentPosition;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function getForegroundLocationPermissionState(): Promise<ForegroundLocationPermissionState> {
  const permission = await Location.getForegroundPermissionsAsync();

  return mapPermissionState(permission);
}

export async function hasForegroundLocationPermission(): Promise<boolean> {
  const permission = await getForegroundLocationPermissionState();

  return permission.granted;
}

export async function requestForegroundLocationPermission(): Promise<boolean> {
  const permission = await requestForegroundLocationPermissionState();

  return permission.granted;
}

export async function requestForegroundLocationPermissionState(): Promise<ForegroundLocationPermissionState> {
  const currentPermission = await Location.getForegroundPermissionsAsync();

  if (currentPermission.status === Location.PermissionStatus.GRANTED) {
    return mapPermissionState(currentPermission);
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  return mapPermissionState(permission);
}

export async function getCurrentDeviceLocation(): Promise<AutoLocation> {
  const currentPosition = (await waitForCurrentPosition()) ??
    (await Location.getLastKnownPositionAsync());

  if (!currentPosition) {
    throw new Error("Unable to determine device location.");
  }

  return {
    latitude: currentPosition.coords.latitude,
    longitude: currentPosition.coords.longitude,
  };
}

export async function requestCurrentDeviceLocationWithPermission(): Promise<CurrentDeviceLocationRequestResult> {
  const permission = await requestForegroundLocationPermissionState();

  if (!permission.granted) {
    return {
      location: null,
      permission,
    };
  }

  try {
    const location = await getCurrentDeviceLocation();

    return {
      location,
      permission,
    };
  } catch {
    return {
      location: null,
      permission,
    };
  }
}

export async function requestCurrentDeviceLocation(): Promise<AutoLocation | null> {
  const result = await requestCurrentDeviceLocationWithPermission();

  return result.location;
}
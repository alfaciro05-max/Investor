import type { InvestmentProduct } from '@/src/lib/dashboard-schema';
import solarEnergyImg from '@/src/assets/images/product_solar_energy_1794705588627.jpg';
import coldLogisticsImg from '@/src/assets/images/product_cold_logistics_1794705587811.jpg';
import umkmDigitalImg from '@/src/assets/images/product_umkm_digital_1794705590783.jpg';
import evFleetImg from '@/src/assets/images/product_ev_fleet_1794705588861.jpg';
import dataCenterImg from '@/src/assets/images/product_data_center_1794705590000.jpg';
import hydroponicFarmImg from '@/src/assets/images/product_hydroponic_farm_1794705590697.jpg';

const PRODUCT_IMAGE_MAP: Record<string, string> = {
  'PRD-01': solarEnergyImg,
  'PRD-02': coldLogisticsImg,
  'PRD-03': umkmDigitalImg,
  'PRD-04': evFleetImg,
  'PRD-05': dataCenterImg,
  'PRD-06': hydroponicFarmImg,
};

const PRODUCT_IMAGE_BY_PATH: Record<string, string> = {
  '/src/assets/images/product_solar_energy_1794705588627.jpg': solarEnergyImg,
  '/src/assets/images/product_cold_logistics_1794705587811.jpg': coldLogisticsImg,
  '/src/assets/images/product_umkm_digital_1794705590783.jpg': umkmDigitalImg,
  '/src/assets/images/product_ev_fleet_1794705588861.jpg': evFleetImg,
  '/src/assets/images/product_data_center_1794705590000.jpg': dataCenterImg,
  '/src/assets/images/product_hydroponic_farm_1794705590697.jpg': hydroponicFarmImg,
};

export function resolveProductImageSrc(
  product?: Pick<InvestmentProduct, 'id' | 'imageUrl'> | null
): string {
  if (!product || !product.imageUrl) {
    return '';
  }
  return (
    PRODUCT_IMAGE_BY_PATH[product.imageUrl] ??
    product.imageUrl ??
    PRODUCT_IMAGE_MAP[product.id] ??
    ''
  );
}

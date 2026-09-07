import {
  FileCheck2, Building2, Network, Globe, ShoppingBag, Award
} from 'lucide-react';

export const PILLAR_CFG = {
  quotes:    { key: 'quotes',    label: 'Cơ sở 1: Báo Giá Gốc',                  color: 'emerald', icon: FileCheck2,  saveKey: 'quotes'     },
  erp:       { key: 'erp',       label: 'Cơ sở 2: ERP Vĩnh Tân 4',               color: 'blue',    icon: Building2,   saveKey: 'erp'        },
  imis:      { key: 'imis',      label: 'Cơ sở 3: EVN IMIS',                     color: 'purple',  icon: Network,     saveKey: 'imis'       },
  msc:       { key: 'msc',       label: 'Cơ sở 4: Mua Sắm Công e-GP',            color: 'orange',  icon: Globe,       saveKey: 'muasamcong' },
  ecom:      { key: 'ecom',      label: 'Cơ sở 5: Thương Mại Điện Tử & Giá Web', color: 'cyan',    icon: ShoppingBag, saveKey: 'ecom'       },
  synthesis: { key: 'synthesis', label: 'Cơ sở 6: Tổng Hợp & Đánh Giá Thẩm Định', color: 'teal',    icon: Award,       saveKey: 'synthesis'  },
};

export const PILLARS = ['quotes', 'erp', 'imis', 'msc', 'ecom', 'synthesis'];

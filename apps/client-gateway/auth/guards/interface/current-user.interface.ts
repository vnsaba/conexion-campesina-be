import { ValidRoles } from '../../enum/valid-roles.enum';

export interface CurrentUser {
  id: string;
  fullname: string;
  email: string;
  role: ValidRoles[];
}
